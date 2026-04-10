/**
 * 주소 + 반경 → 매칭 단지 검색 API
 */
import { NextRequest, NextResponse } from 'next/server';
import { appendActivityLog, getClientIp } from '@/lib/activityLog';
import { searchNearby } from '@/lib/masterData';
import {
  parseCampaignDate,
  parseCoordinatePair,
  parseDistricts,
  parseRadii,
  parseSortBy,
  ValidationError,
} from '@/lib/requestValidation';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      lat,
      lng,
      address,
      radii = [1, 1.5, 3],
      districts = [],
      require_ev = false,
      sort_by = 'distance',
      advertiser_industry,
      campaign_date,
      advertiser_name,
      campaign_name,
    } = body;

    const coords = parseCoordinatePair(lat, lng, true);
    const normalizedRadii = parseRadii(radii, true);
    const normalizedDistricts = parseDistricts(districts, false);
    const normalizedDate = parseCampaignDate(campaign_date);

    if (!coords) {
      return NextResponse.json({ error: '유효한 좌표를 입력해주세요.' }, { status: 400 });
    }

    const result = await searchNearby({
      address: address || '',
      lat: coords.lat,
      lng: coords.lng,
      radii: normalizedRadii,
      districts: normalizedDistricts,
      require_ev: Boolean(require_ev),
      sort_by: parseSortBy(sort_by),
      advertiser_industry,
      campaign_date: normalizedDate,
      advertiser_name,
      campaign_name,
    });

    void appendActivityLog({
        action: 'search',
        address: address || '',
        radii: normalizedRadii,
        resultCount: result.total_count,
        advertiserName: advertiser_name || '',
        campaignName: campaign_name || '',
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
