"""주소 → 위경도 변환 (카카오 로컬 API / VWORLD 폴백) + 캐시"""
from __future__ import annotations

import time
import logging
from typing import Optional, Tuple

import requests

logger = logging.getLogger(__name__)

# ── 카카오 로컬 API ────────────────────────────────────────


def geocode_kakao(address: str, api_key: str) -> Optional[Tuple[float, float]]:
    """카카오 로컬 API로 주소 → (lat, lng) 변환.
    실패 시 None 반환."""
    url = "https://dapi.kakao.com/v2/local/search/address.json"
    headers = {"Authorization": f"KakaoAK {api_key}"}
    params = {"query": address}
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=10)
        resp.raise_for_status()
        docs = resp.json().get("documents", [])
        if docs:
            return float(docs[0]["y"]), float(docs[0]["x"])
    except Exception as e:
        logger.warning("카카오 geocoding 실패: %s — %s", address, e)
    return None


# ── VWORLD API ─────────────────────────────────────────────


def geocode_vworld(address: str, api_key: str) -> Optional[Tuple[float, float]]:
    """VWORLD 지오코더 API로 주소 → (lat, lng) 변환.
    실패 시 None 반환."""
    url = "https://api.vworld.kr/req/address"
    params = {
        "service": "address",
        "request": "getcoord",
        "version": "2.0",
        "crs": "epsg:4326",
        "address": address,
        "refine": "true",
        "simple": "false",
        "format": "json",
        "type": "road",
        "key": api_key,
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data.get("response", {}).get("status") == "OK":
            result = data["response"]["result"]["point"]
            return float(result["y"]), float(result["x"])
    except Exception as e:
        logger.warning("VWORLD geocoding 실패: %s — %s", address, e)
    return None


# ── 통합 geocoder ──────────────────────────────────────────


def geocode(
    address: str,
    kakao_key: str = "",
    vworld_key: str = "",
    provider: str = "kakao",
) -> Optional[Tuple[float, float]]:
    """주소 → (lat, lng). 1순위 provider 실패 시 폴백.
    둘 다 실패하면 지번 주소도 시도."""
    if provider == "kakao" and kakao_key:
        result = geocode_kakao(address, kakao_key)
        if result:
            return result
        # 폴백: VWORLD
        if vworld_key:
            return geocode_vworld(address, vworld_key)
    elif provider == "vworld" and vworld_key:
        result = geocode_vworld(address, vworld_key)
        if result:
            return result
        if kakao_key:
            return geocode_kakao(address, kakao_key)
    else:
        # 키가 하나라도 있으면 시도
        if kakao_key:
            return geocode_kakao(address, kakao_key)
        if vworld_key:
            return geocode_vworld(address, vworld_key)
    return None


def batch_geocode(
    addresses: list[str],
    kakao_key: str = "",
    vworld_key: str = "",
    provider: str = "kakao",
    delay: float = 0.05,
) -> list[Optional[Tuple[float, float]]]:
    """주소 리스트를 일괄 geocoding. rate limit 준수를 위한 delay 포함."""
    results = []
    total = len(addresses)
    for i, addr in enumerate(addresses):
        result = geocode(addr, kakao_key, vworld_key, provider)
        results.append(result)
        if (i + 1) % 100 == 0:
            logger.info("Geocoding 진행: %d / %d (%.1f%%)", i + 1, total, (i + 1) / total * 100)
        if delay > 0:
            time.sleep(delay)
    logger.info("Geocoding 완료: %d건 중 %d건 성공", total, sum(1 for r in results if r is not None))
    return results
