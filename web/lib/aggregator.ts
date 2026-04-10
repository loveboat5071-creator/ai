/**
 * 지역별 집계 — 시/구별 groupby
 */

import type { MatchedComplex, RegionSummary } from './types';

export function aggregateByRegion(complexes: MatchedComplex[]): RegionSummary[] {
  const map = new Map<string, RegionSummary>();

  for (const c of complexes) {
    const key = `${c.city}|${c.district}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        city: c.city,
        district: c.district,
        count: 0,
        total_households: 0,
        total_units: 0,
        total_price_4w: 0,
        avg_unit_price: 0,
      };
      map.set(key, entry);
    }
    entry.count += 1;
    entry.total_households += c.households || 0;
    entry.total_units += c.units || 0;
    entry.total_price_4w += c.price_4w || 0;
  }

  const result = Array.from(map.values());
  // 평균 단가 계산
  for (const r of result) {
    r.avg_unit_price = r.total_units > 0
      ? Math.round(r.total_price_4w / r.total_units)
      : 0;
  }

  // 도시→구 순 정렬
  result.sort((a, b) => {
    const cityComp = a.city.localeCompare(b.city, 'ko');
    return cityComp !== 0 ? cityComp : a.district.localeCompare(b.district, 'ko');
  });

  return result;
}
