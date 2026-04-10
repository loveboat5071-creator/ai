#!/usr/bin/env python3
"""
마스터 데이터 일괄 Geocoding 스크립트
설치리스트의 도로명주소를 카카오 API로 좌표 변환 → master.json에 lat/lng 추가

사용법:
    export KAKAO_API_KEY=your_key_here
    python3 scripts/geocode_master.py
"""

import json
import os
import sys
import time
import requests
from pathlib import Path

KAKAO_API_KEY = os.environ.get("KAKAO_API_KEY", "")
MASTER_JSON = Path(__file__).parent.parent / "web" / "public" / "data" / "master.json"
CACHE_FILE = Path(__file__).parent.parent / "web" / "public" / "data" / "geocode_cache.json"


def geocode_kakao(address: str) -> dict | None:
    """카카오 로컬 API로 주소 → (lat, lng)"""
    url = "https://dapi.kakao.com/v2/local/search/address.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_API_KEY}"}
    try:
        resp = requests.get(url, headers=headers, params={"query": address}, timeout=10)
        resp.raise_for_status()
        docs = resp.json().get("documents", [])
        if docs:
            return {"lat": float(docs[0]["y"]), "lng": float(docs[0]["x"])}
    except Exception as e:
        print(f"  ⚠ 실패: {address} — {e}")
    return None


def main():
    if not KAKAO_API_KEY:
        print("❌ KAKAO_API_KEY 환경변수를 설정하세요.")
        print("   export KAKAO_API_KEY=your_key_here")
        sys.exit(1)

    # 마스터 데이터 로드
    with open(MASTER_JSON, "r", encoding="utf-8") as f:
        records = json.load(f)
    print(f"📦 마스터 데이터 로드: {len(records)}건")

    # 기존 캐시 로드
    cache = {}
    if CACHE_FILE.exists():
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            cache = json.load(f)
        print(f"📋 기존 캐시: {len(cache)}건")

    # Geocoding 실행
    success = 0
    skipped = 0
    failed = 0

    for i, rec in enumerate(records):
        addr = rec.get("addr_road", "")
        if not addr:
            failed += 1
            continue

        # 캐시 확인
        if addr in cache:
            rec["lat"] = cache[addr]["lat"]
            rec["lng"] = cache[addr]["lng"]
            skipped += 1
            continue

        # API 호출
        result = geocode_kakao(addr)
        if result:
            rec["lat"] = result["lat"]
            rec["lng"] = result["lng"]
            cache[addr] = result
            success += 1
        else:
            failed += 1

        # 진행 상황  
        if (i + 1) % 100 == 0:
            print(f"  진행: {i+1}/{len(records)} (성공:{success} 캐시:{skipped} 실패:{failed})")
            # 중간 저장
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False)

        time.sleep(0.05)  # rate limit

    # 최종 저장
    with open(MASTER_JSON, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False)

    print(f"\n✅ Geocoding 완료!")
    print(f"   성공: {success}건 | 캐시 활용: {skipped}건 | 실패: {failed}건")
    print(f"   결과: {MASTER_JSON}")
    print(f"   캐시: {CACHE_FILE}")


if __name__ == "__main__":
    main()
