/**
 * Haversine 공식 기반 거리 계산 (WGS84)
 * numpy 벡터 연산 대신 JS로 직접 구현 — 4,621건 기준 <5ms
 */

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371.0;

/** 두 좌표 간 거리 (km) — Haversine */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * 다중 반경 필터링 — 정렬된 radii에 대해 가장 작은 포함 반경을 band로 할당
 * @returns 각 레코드의 [distance_km, radius_band] 또는 null(범위 밖)
 */
export function classifyByRadius(
  distance: number,
  radii: number[]
): { distance_km: number; radius_band: number } | null {
  const sorted = [...radii].sort((a, b) => a - b);
  for (const r of sorted) {
    if (distance <= r) {
      return { distance_km: Math.round(distance * 1000) / 1000, radius_band: r };
    }
  }
  return null;
}
