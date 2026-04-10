/**
 * 영업제한 업종 목록 API
 * 마스터 데이터의 r1_industry, r2_industry에서 고유값 추출
 */
import { NextResponse } from 'next/server';
import { loadMasterDataAsync } from '@/lib/masterData';

export async function GET() {
  const data = await loadMasterDataAsync();
  const industries = new Set<string>();

  for (const d of data) {
    if (d.r1_industry) industries.add(d.r1_industry);
    if (d.r2_industry) industries.add(d.r2_industry);
  }

  const sorted = [...industries].sort((a, b) => a.localeCompare(b, 'ko'));

  return NextResponse.json({
    industries: sorted,
    count: sorted.length,
  });
}
