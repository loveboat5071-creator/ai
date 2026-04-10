/**
 * 지역(시/도 → 구/군) 목록 API
 * 마스터 데이터의 city + district 필드에서 계층적 구조 추출
 */
import { NextResponse } from 'next/server';
import { loadMasterDataAsync } from '@/lib/masterData';

export async function GET() {
  const data = await loadMasterDataAsync();
  const cityMap = new Map<string, Set<string>>();

  for (const d of data) {
    if (!d.city || !d.district) continue;
    // 시/도 이름 정규화 (서울특별시 → 서울)
    const city = d.city.replace(/특별시|광역시|특별자치시|특별자치도/g, '').trim();
    if (!cityMap.has(city)) cityMap.set(city, new Set());
    cityMap.get(city)!.add(d.district);
  }

  // city 기준 정렬 (서울 우선)
  const CITY_ORDER = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

  const grouped: { city: string; districts: string[] }[] = [];
  const allDistricts: string[] = [];

  for (const city of CITY_ORDER) {
    if (cityMap.has(city)) {
      const districts = [...cityMap.get(city)!].sort((a, b) => a.localeCompare(b, 'ko'));
      grouped.push({ city, districts });
      districts.forEach(d => allDistricts.push(d));
      cityMap.delete(city);
    }
  }
  // 나머지 (정렬 순서에 없는 도시)
  for (const [city, set] of cityMap) {
    const districts = [...set].sort((a, b) => a.localeCompare(b, 'ko'));
    grouped.push({ city, districts });
    districts.forEach(d => allDistricts.push(d));
  }

  return NextResponse.json({
    grouped,
    districts: allDistricts,
    count: allDistricts.length,
  });
}
