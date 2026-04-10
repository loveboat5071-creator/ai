/**
 * 지역별 조회 API — 구/군 이름으로 검색 (반경 없음)
 */
import { NextRequest, NextResponse } from 'next/server';
import { appendActivityLog, getClientIp } from '@/lib/activityLog';
import { searchByDistrict } from '@/lib/masterData';
import { parseCampaignDate, parseDistricts, parseSortBy, ValidationError } from '@/lib/requestValidation';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      districts = [],
      require_ev = false,
      sort_by = 'distance',
      advertiser_industry,
      campaign_date,
      advertiser_name,
      campaign_name,
    } = body;

    const normalizedDistricts = parseDistricts(districts, true);
    const normalizedDate = parseCampaignDate(campaign_date);

    const result = await searchByDistrict({
      districts: normalizedDistricts,
      require_ev: Boolean(require_ev),
      sort_by: parseSortBy(sort_by),
      advertiser_industry,
      campaign_date: normalizedDate,
    });

    void appendActivityLog({
      action: 'search-district',
      address: districts.join(', '),
      radii: [],
      resultCount: result.total_count,
      advertiserName: String(advertiser_name || ''),
      campaignName: String(campaign_name || ''),
      ip: getClientIp(req.headers),
    }).catch(() => {});

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: `검색 실패: ${e}` }, { status: 500 });
  }
}
