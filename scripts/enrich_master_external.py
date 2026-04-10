#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import statistics
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any
from zipfile import ZipFile

import requests


ROOT = Path(__file__).resolve().parent.parent
MASTER_PATH = ROOT / "web" / "public" / "data" / "master.json"
DATA_DIR = ROOT / "data_sources"
SUMMARY_PATH = DATA_DIR / "enrichment_summary.json"

PRICE_URL = (
    "https://www.data.go.kr/cmm/cmm/fileDownload.do"
    "?atchFileId=FILE_000000003525375&fileDetailSn=1&insertDataPrcus=N"
)
EV_URL = (
    "https://www.data.go.kr/cmm/cmm/fileDownload.do"
    "?atchFileId=FILE_000000003154629&fileDetailSn=1&insertDataPrcus=N"
)

PRICE_ZIP_PATH = DATA_DIR / "public_price_2025.zip"
EV_CSV_PATH = DATA_DIR / "ev_chargers_20250531.csv"

PRICE_BASE_DATE = "2025-01-01"
PRICE_SOURCE = "국토교통부_주택 공시가격 정보(2025)"
EV_SOURCE = "한국전력공사_전기차충전소위경도_20250531"
RT_SOURCE = "국토교통부_실거래가공개시스템_아파트매매_최근1년"
RT_BASE_URL = "https://rt.molit.go.kr"
RT_CSV_DIR = DATA_DIR / "rt_trade_csv"


def download_file(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        print(f"[skip] {path.name} already exists")
        return
    print(f"[download] {path.name}")
    with urllib.request.urlopen(url) as response, path.open("wb") as output:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            output.write(chunk)


def collapse_city_district(value: str | None) -> str:
    if not value:
        return ""
    text = normalize_space(value)
    text = re.sub(r"([가-힣]+)시\s*([가-힣]+(?:구|군))", r"\1\2", text)
    text = re.sub(r"([가-힣]+)군\s*([가-힣]+(?:읍|면))", r"\1\2", text)
    return text


def normalize_space(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def normalize_loose(value: str | None) -> str:
    if not value:
        return ""
    text = value.lower()
    text = text.replace("e-편한세상", "e편한세상")
    text = text.replace("e편한세상", "e편한세상")
    text = text.replace("더샵", "더샾")
    text = re.sub(r"\(.*?\)", "", text)
    text = re.sub(r"[^\w가-힣]", "", text)
    return text


def normalize_name(value: str | None) -> str:
    text = normalize_loose(value)
    for suffix in ("아파트", "오피스텔", "주상복합", "주거복합", "타운", "맨션"):
        text = text.replace(suffix, "")
    return text


def base_road_address(value: str | None) -> str:
    return normalize_space((value or "").split("(")[0])


def normalize_address_key(value: str | None) -> str:
    return normalize_loose(collapse_city_district(base_road_address(value)))


def normalize_city(value: str | None) -> str:
    return normalize_loose(value)


def normalize_district(value: str | None) -> str:
    return normalize_loose(collapse_city_district(value))


def normalize_dong(value: str | None) -> str:
    return normalize_loose(value)


def parse_rt_area(value: str | None) -> tuple[str, str, str]:
    tokens = normalize_space(value).split()
    if not tokens:
        return "", "", ""
    city = tokens[0]
    if len(tokens) >= 4 and tokens[1].endswith("시") and tokens[2].endswith(("구", "군")):
        district = f"{tokens[1]} {tokens[2]}"
        dong = tokens[3]
    else:
        district = tokens[1] if len(tokens) > 1 else ""
        dong = tokens[2] if len(tokens) > 2 else ""
    return city, district, dong


def extract_road_tail(value: str | None) -> str:
    text = normalize_space(collapse_city_district(base_road_address(value)))
    if not text:
        return ""
    tokens = text.split()
    for idx, token in enumerate(tokens):
        if re.search(r"\d", token) or token.endswith(("로", "길", "대로", "거리", "번길")):
            return normalize_loose(" ".join(tokens[idx:]))
    return normalize_loose(text)


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return 2 * 6371000 * math.asin(math.sqrt(a))


def get_zip_member(zip_path: Path, suffix: str) -> str:
    with ZipFile(zip_path) as zf:
        for name in zf.namelist():
            if name.endswith(suffix):
                return name
    raise FileNotFoundError(f"Could not find member ending with {suffix} in {zip_path}")


@dataclass
class PriceAccumulator:
    prices: list[int]
    price_per_m2: list[float]
    methods: Counter[str]


@dataclass
class EvEvidence:
    count: int = 0
    level: str | None = None
    source: str | None = None
    text: str | None = None
    distance_m: float | None = None


def ensure_sources(download: bool) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if download:
        download_file(PRICE_URL, PRICE_ZIP_PATH)
        download_file(EV_URL, EV_CSV_PATH)
    missing = [str(path) for path in (PRICE_ZIP_PATH, EV_CSV_PATH) if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing source files: {missing}")


def load_master() -> list[dict[str, Any]]:
    with MASTER_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def build_price_indexes(master: list[dict[str, Any]]) -> tuple[
    dict[tuple[str, str], list[int]],
    dict[str, list[int]],
    dict[tuple[str, str, str, str], list[int]],
    dict[tuple[str, str], list[int]],
]:
    by_road_and_name: dict[tuple[str, str], list[int]] = defaultdict(list)
    by_road: dict[str, list[int]] = defaultdict(list)
    by_area_and_name: dict[tuple[str, str, str, str], list[int]] = defaultdict(list)
    by_city_and_road_tail: dict[tuple[str, str], list[int]] = defaultdict(list)

    for idx, item in enumerate(master):
        road_key = normalize_address_key(item.get("addr_road"))
        road_tail_key = extract_road_tail(item.get("addr_road"))
        name_key = normalize_name(item.get("name"))
        city_key = normalize_city(item.get("city"))
        if road_key:
            by_road_and_name[(road_key, name_key)].append(idx)
            by_road[road_key].append(idx)
        if city_key and road_tail_key:
            by_city_and_road_tail[(city_key, road_tail_key)].append(idx)
        area_key = (
            city_key,
            normalize_district(item.get("district")),
            normalize_dong(item.get("dong")),
            name_key,
        )
        by_area_and_name[area_key].append(idx)

    return by_road_and_name, by_road, by_area_and_name, by_city_and_road_tail


def accumulate_price_data(master: list[dict[str, Any]]) -> dict[int, PriceAccumulator]:
    road_name_map, road_map, area_name_map, city_road_tail_map = build_price_indexes(master)
    acc: dict[int, PriceAccumulator] = defaultdict(
        lambda: PriceAccumulator(prices=[], price_per_m2=[], methods=Counter())
    )
    sample_name = get_zip_member(PRICE_ZIP_PATH, "_샘플데이터.csv")
    data_name = get_zip_member(PRICE_ZIP_PATH, ".csv")
    if data_name == sample_name:
        raise RuntimeError("Could not resolve main public price csv")

    with ZipFile(PRICE_ZIP_PATH) as zf:
        with zf.open(data_name) as raw_handle:
            text_handle = io.TextIOWrapper(raw_handle, encoding="utf-8", newline="")
            reader = csv.DictReader(text_handle)
            for row_number, row in enumerate(reader, start=1):
                if row_number % 500000 == 0:
                    print(f"[price] processed {row_number:,} rows")

                price = row.get("공시가격")
                area = row.get("전용면적")
                if not price or not area:
                    continue

                try:
                    price_value = int(float(price))
                    area_value = float(area)
                except ValueError:
                    continue
                if price_value <= 0 or area_value <= 0:
                    continue

                road_key = normalize_address_key(row.get("도로명주소"))
                road_tail_key = extract_road_tail(row.get("도로명주소"))
                name_key = normalize_name(row.get("단지명"))
                city_key = normalize_city(row.get("시도"))
                area_key = (
                    city_key,
                    normalize_district(row.get("시군구")),
                    normalize_dong(row.get("동리")),
                    name_key,
                )

                indices: list[int] = []
                method = ""
                if road_key and (road_key, name_key) in road_name_map:
                    indices = road_name_map[(road_key, name_key)]
                    method = "road+name"
                elif road_key and len(road_map.get(road_key, [])) == 1:
                    indices = road_map[road_key]
                    method = "road-only-unique"
                elif city_key and road_tail_key and len(city_road_tail_map.get((city_key, road_tail_key), [])) == 1:
                    indices = city_road_tail_map[(city_key, road_tail_key)]
                    method = "city+road-tail-unique"
                elif len(area_name_map.get(area_key, [])) == 1:
                    indices = area_name_map[area_key]
                    method = "area+name"

                if not indices:
                    continue

                for idx in indices:
                    bucket = acc[idx]
                    bucket.prices.append(price_value)
                    bucket.price_per_m2.append(price_value / area_value)
                    bucket.methods[method] += 1

    return acc


def enrich_price(master: list[dict[str, Any]]) -> dict[str, Any]:
    print("[price] start enrichment")
    acc = accumulate_price_data(master)
    matched = 0
    for idx, item in enumerate(master):
        bucket = acc.get(idx)
        if not bucket or not bucket.prices:
            item["public_price_median"] = None
            item["public_price_max"] = None
            item["public_price_per_m2_median"] = None
            item["public_price_sample_count"] = 0
            item["public_price_base_date"] = PRICE_BASE_DATE
            item["public_price_source"] = PRICE_SOURCE
            item["public_price_match_method"] = None
            continue

        matched += 1
        item["public_price_median"] = int(statistics.median(bucket.prices))
        item["public_price_max"] = max(bucket.prices)
        item["public_price_per_m2_median"] = round(statistics.median(bucket.price_per_m2), 2)
        item["public_price_sample_count"] = len(bucket.prices)
        item["public_price_base_date"] = PRICE_BASE_DATE
        item["public_price_source"] = PRICE_SOURCE
        item["public_price_match_method"] = bucket.methods.most_common(1)[0][0]

    return {
        "matched_complexes": matched,
        "unmatched_complexes": len(master) - matched,
        "coverage_pct": round((matched / len(master)) * 100, 2),
    }


def summarize_existing_numeric(master: list[dict[str, Any]], field: str) -> dict[str, Any]:
    matched = sum(1 for item in master if item.get(field) is not None)
    return {
        "matched_complexes": matched,
        "unmatched_complexes": len(master) - matched,
        "coverage_pct": round((matched / len(master)) * 100, 2),
    }


def summarize_existing_ev(master: list[dict[str, Any]]) -> dict[str, Any]:
    level_counter = Counter(item.get("ev_evidence_level") for item in master if item.get("ev_evidence_level"))
    installed_true = sum(1 for item in master if item.get("ev_charger_installed"))
    return {
        "matched_high": level_counter["high"],
        "matched_medium": level_counter["medium"],
        "matched_low": level_counter["low"],
        "installed_true": installed_true,
        "installed_false": len(master) - installed_true,
    }


def build_rt_region_lookup(
    master: list[dict[str, Any]],
    session: requests.Session,
) -> dict[tuple[str, str], tuple[str, str, str, str]]:
    city_map: dict[str, tuple[str, str]] = {}
    district_map: dict[tuple[str, str], tuple[str, str, str, str]] = {}

    sido_list = session.post(f"{RT_BASE_URL}/data/sido.do", data={}, timeout=30).json()
    for row in sido_list:
        city_name = normalize_space(row.get("ctprvnNm"))
        signgu_code = normalize_space(row.get("signguCode"))
        if city_name and signgu_code:
            city_map[normalize_city(city_name)] = (city_name, signgu_code)

    needed_cities = sorted({normalize_city(item.get("city")) for item in master if item.get("city")})
    for city_key in needed_cities:
        city_entry = city_map.get(city_key)
        if not city_entry:
            continue
        city_name, city_code = city_entry
        sgg_list = session.post(
            f"{RT_BASE_URL}/data/sgg.do",
            data={"signguCode": city_code[:2]},
            timeout=30,
        ).json()
        for row in sgg_list:
            district_name = normalize_space(row.get("signguNm"))
            district_code = normalize_space(row.get("signguCode"))
            if not district_name or not district_code:
                continue
            district_map[(city_key, normalize_district(district_name))] = (
                city_name,
                city_code,
                district_name,
                district_code,
            )

    return district_map


def download_rt_csv(
    session: requests.Session,
    city_name: str,
    city_code: str,
    district_name: str,
    district_code: str,
) -> Path:
    RT_CSV_DIR.mkdir(parents=True, exist_ok=True)
    period_end = date.today()
    period_start = period_end - timedelta(days=364)
    cache_name = (
        f"{city_code}_{district_code}_{period_start.isoformat()}_{period_end.isoformat()}.csv"
    )
    cache_path = RT_CSV_DIR / cache_name
    if cache_path.exists():
        return cache_path

    form = {
        "srhThingNo": "A",
        "srhDelngSecd": "1",
        "srhAddrGbn": "1",
        "srhLfstsSecd": "1",
        "sidoNm": city_name,
        "sggNm": district_name,
        "emdNm": "",
        "loadNm": "",
        "areaNm": "",
        "hsmpNm": "",
        "mobileAt": "",
        "srhFromDt": period_start.isoformat(),
        "srhToDt": period_end.isoformat(),
        "srhNewRonSecd": "",
        "srhSidoCd": city_code,
        "srhSggCd": district_code,
        "srhEmdCd": "",
        "srhRoadNm": "",
        "srhLoadCd": "",
        "srhHsmpCd": "",
        "srhArea": "",
        "srhLrArea": "",
        "srhFromAmount": "",
        "srhToAmount": "",
    }
    response = session.post(
        f"{RT_BASE_URL}/pt/xls/ptXlsCSVDown.do",
        data=form,
        timeout=120,
    )
    response.raise_for_status()

    text = response.text
    if '"NO","시군구"' not in text:
        raise RuntimeError(f"Unexpected RT response for {city_name} {district_name}")

    cache_path.write_text(text, encoding="utf-8")
    time.sleep(0.15)
    return cache_path


def accumulate_rt_data(master: list[dict[str, Any]]) -> tuple[dict[int, PriceAccumulator], dict[str, int]]:
    print("[rt] start enrichment")
    road_name_map, road_map, area_name_map, city_road_tail_map = build_price_indexes(master)
    acc: dict[int, PriceAccumulator] = defaultdict(
        lambda: PriceAccumulator(prices=[], price_per_m2=[], methods=Counter())
    )
    stats = {"district_csvs": 0, "rows": 0, "download_errors": 0}

    session = requests.Session()
    region_lookup = build_rt_region_lookup(master, session)
    district_pairs = sorted({
        (normalize_city(item.get("city")), normalize_district(item.get("district")))
        for item in master
        if item.get("city") and item.get("district")
    })

    total_districts = len(district_pairs)
    downloaded_codes: set[str] = set()
    for index, (city_key, district_key) in enumerate(district_pairs, start=1):
        regions = []
        region = region_lookup.get((city_key, district_key))
        if region:
            regions = [region]
        elif district_key == normalize_district("화성시"):
            regions = [
                value
                for (lookup_city_key, _), value in region_lookup.items()
                if lookup_city_key == city_key and value[2].startswith("화성시 ")
            ]
        if not regions:
            continue
        for city_name, city_code, district_name, district_code in regions:
            if district_code in downloaded_codes:
                continue
            downloaded_codes.add(district_code)
            try:
                print(f"[rt] fetch {index}/{total_districts} {city_name} {district_name}")
                csv_path = download_rt_csv(session, city_name, city_code, district_name, district_code)
            except Exception as exc:
                stats["download_errors"] += 1
                print(f"[rt] skip {city_name} {district_name}: {exc}")
                continue

            stats["district_csvs"] += 1
            text = csv_path.read_text(encoding="utf-8")
            header_idx = text.find('"NO","시군구"')
            if header_idx < 0:
                continue

            reader = csv.DictReader(io.StringIO(text[header_idx:]))
            for row in reader:
                stats["rows"] += 1
                price = (row.get("거래금액(만원)") or "").replace(",", "").strip()
                area = row.get("전용면적(㎡)")
                road_name = row.get("도로명")
                if not price or not area or not road_name:
                    continue

                try:
                    price_value = int(price) * 10000
                    area_value = float(area)
                except ValueError:
                    continue
                if price_value <= 0 or area_value <= 0:
                    continue

                rt_city, rt_district, rt_dong = parse_rt_area(row.get("시군구"))
                city_key_from_row = normalize_city(rt_city)
                road_key = normalize_address_key(f"{rt_city} {rt_district} {road_name}")
                road_tail_key = extract_road_tail(road_name)
                name_key = normalize_name(row.get("단지명"))
                area_key = (
                    city_key_from_row,
                    normalize_district(rt_district),
                    normalize_dong(rt_dong),
                    name_key,
                )

                indices: list[int] = []
                method = ""
                if road_key and (road_key, name_key) in road_name_map:
                    indices = road_name_map[(road_key, name_key)]
                    method = "road+name"
                elif road_key and len(road_map.get(road_key, [])) == 1:
                    indices = road_map[road_key]
                    method = "road-only-unique"
                elif city_key_from_row and road_tail_key and len(city_road_tail_map.get((city_key_from_row, road_tail_key), [])) == 1:
                    indices = city_road_tail_map[(city_key_from_row, road_tail_key)]
                    method = "city+road-tail-unique"
                elif len(area_name_map.get(area_key, [])) == 1:
                    indices = area_name_map[area_key]
                    method = "area+name"

                if not indices:
                    continue

                for idx in indices:
                    bucket = acc[idx]
                    bucket.prices.append(price_value)
                    bucket.price_per_m2.append(price_value / area_value)
                    bucket.methods[method] += 1

    return acc, stats


def enrich_rt(master: list[dict[str, Any]]) -> dict[str, Any]:
    acc, stats = accumulate_rt_data(master)
    matched = 0
    for idx, item in enumerate(master):
        bucket = acc.get(idx)
        if not bucket or not bucket.prices:
            item["rt_price_median"] = None
            item["rt_price_per_m2_median"] = None
            item["rt_price_sample_count"] = 0
            item["rt_price_base_period"] = None
            item["rt_price_source"] = RT_SOURCE
            item["rt_price_match_method"] = None
            continue

        matched += 1
        item["rt_price_median"] = int(statistics.median(bucket.prices))
        item["rt_price_per_m2_median"] = round(statistics.median(bucket.price_per_m2), 2)
        item["rt_price_sample_count"] = len(bucket.prices)
        period_end = date.today()
        period_start = period_end - timedelta(days=364)
        item["rt_price_base_period"] = f"{period_start.isoformat()}~{period_end.isoformat()}"
        item["rt_price_source"] = RT_SOURCE
        item["rt_price_match_method"] = bucket.methods.most_common(1)[0][0]

    return {
        "matched_complexes": matched,
        "unmatched_complexes": len(master) - matched,
        "coverage_pct": round((matched / len(master)) * 100, 2),
        **stats,
    }


def load_ev_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with EV_CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            try:
                rows.append(
                    {
                        "id": row["충전소ID"],
                        "name": normalize_space(row["충전소명"]),
                        "address": normalize_space(row["충전소주소"]),
                        "lat": float(row["위도"]),
                        "lng": float(row["경도"]),
                    }
                )
            except (KeyError, ValueError):
                continue
    return rows


def enrich_ev(master: list[dict[str, Any]]) -> dict[str, Any]:
    print("[ev] start enrichment")
    chargers = load_ev_rows()
    road_map: dict[str, list[int]] = defaultdict(list)
    parcel_map: dict[str, list[int]] = defaultdict(list)
    district_strings: list[str] = []
    dong_strings: list[str] = []

    for idx, item in enumerate(master):
        road_map[normalize_address_key(item.get("addr_road"))].append(idx)
        parcel_map[normalize_address_key(item.get("addr_parcel"))].append(idx)
        district_strings.append(normalize_space(item.get("district")))
        dong_strings.append(normalize_space(item.get("dong")))

    evidences = [EvEvidence() for _ in master]

    for charger in chargers:
        address_key = normalize_address_key(charger["address"])
        exact_indices = set(road_map.get(address_key, [])) | set(parcel_map.get(address_key, []))
        if not exact_indices:
            continue
        for idx in exact_indices:
            evidence = evidences[idx]
            evidence.count += 1
            evidence.level = "high"
            evidence.source = EV_SOURCE
            evidence.text = "공식 충전소 주소와 단지 주소가 일치합니다."
            evidence.distance_m = 0.0

    for idx, item in enumerate(master):
        evidence = evidences[idx]
        if evidence.level == "high":
            continue

        lat = item.get("lat")
        lng = item.get("lng")
        if lat is None or lng is None:
            continue

        district = district_strings[idx]
        dong = dong_strings[idx]
        nearby_medium: list[tuple[float, dict[str, Any]]] = []
        nearby_low: list[tuple[float, dict[str, Any]]] = []

        for charger in chargers:
            if district and district not in charger["address"]:
                continue
            dist_m = haversine_m(lat, lng, charger["lat"], charger["lng"])
            if dong and dong in charger["address"] and dist_m <= 80:
                nearby_medium.append((dist_m, charger))
            elif dist_m <= 150:
                nearby_low.append((dist_m, charger))

        if nearby_medium:
            nearby_medium.sort(key=lambda entry: entry[0])
            evidence.count = len(nearby_medium)
            evidence.level = "medium"
            evidence.source = EV_SOURCE
            evidence.distance_m = round(nearby_medium[0][0], 1)
            evidence.text = (
                f"공식 충전소 {len(nearby_medium)}기가 단지 좌표 기준 "
                f"{evidence.distance_m}m 이내에서 확인됩니다."
            )
        elif nearby_low:
            nearby_low.sort(key=lambda entry: entry[0])
            evidence.count = len(nearby_low)
            evidence.level = "low"
            evidence.source = EV_SOURCE
            evidence.distance_m = round(nearby_low[0][0], 1)
            evidence.text = (
                f"공식 충전소가 단지 좌표 기준 {evidence.distance_m}m 이내에 있으나 "
                "단지 내부 설치 여부는 추가 확인이 필요합니다."
            )

    level_counter = Counter()
    for idx, item in enumerate(master):
        evidence = evidences[idx]
        item["ev_charger_installed"] = evidence.level in {"high", "medium"}
        item["ev_charger_count"] = evidence.count or 0
        item["ev_evidence_level"] = evidence.level
        item["ev_evidence_text"] = evidence.text
        item["ev_evidence_source"] = evidence.source
        item["ev_nearest_distance_m"] = evidence.distance_m
        item["ev_updated_at"] = date.today().isoformat()
        if evidence.level:
            level_counter[evidence.level] += 1

    return {
        "matched_high": level_counter["high"],
        "matched_medium": level_counter["medium"],
        "matched_low": level_counter["low"],
        "installed_true": sum(1 for item in master if item["ev_charger_installed"]),
        "installed_false": sum(1 for item in master if not item["ev_charger_installed"]),
    }


def write_outputs(master: list[dict[str, Any]], summary: dict[str, Any]) -> None:
    with MASTER_PATH.open("w", encoding="utf-8") as handle:
        json.dump(master, handle, ensure_ascii=False, indent=2)
    with SUMMARY_PATH.open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=2)


def main() -> int:
    parser = argparse.ArgumentParser(description="Enrich master.json with public price and EV charger evidence.")
    parser.add_argument("--no-download", action="store_true", help="Use existing source files only.")
    parser.add_argument("--skip-price", action="store_true", help="Keep existing public price fields.")
    parser.add_argument("--skip-rt", action="store_true", help="Keep existing real transaction fields.")
    parser.add_argument("--skip-ev", action="store_true", help="Keep existing EV evidence fields.")
    args = parser.parse_args()

    ensure_sources(download=not args.no_download)
    master = load_master()
    price_summary = summarize_existing_numeric(master, "public_price_median") if args.skip_price else enrich_price(master)
    rt_summary = summarize_existing_numeric(master, "rt_price_per_m2_median") if args.skip_rt else enrich_rt(master)
    ev_summary = summarize_existing_ev(master) if args.skip_ev else enrich_ev(master)
    summary = {
        "master_count": len(master),
        "price": price_summary,
        "rt": rt_summary,
        "ev": ev_summary,
        "sources": {
            "price": str(PRICE_ZIP_PATH),
            "rt": str(RT_CSV_DIR),
            "ev": str(EV_CSV_PATH),
        },
    }
    write_outputs(master, summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
