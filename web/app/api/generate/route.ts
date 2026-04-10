/**
 * 견적서 Excel 다운로드 API
 */
import { NextRequest, NextResponse } from 'next/server';
import { appendActivityLog, getClientIp } from '@/lib/activityLog';
import { sanitizeFilenameSegment } from '@/lib/escape';
import { searchNearby, searchByDistrict } from '@/lib/masterData';
import { generateExcel } from '@/lib/excelGenerator';
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
      lat, lng, address,
      radii = [],
      districts = [],
      require_ev = false,
      sort_by = 'distance',
      advertiser_industry,
      campaign_date,
      advertiser_name = '',
      campaign_name = '',
      creative_message = '',
      creative_asset_kinds = [],
      creative_format = 'both',
      creative_audio_mode = 'bgm_narration',
    } = body;

    const coords = parseCoordinatePair(lat, lng, false);
    const districtsList = parseDistricts(districts, false);
    const radiiList = parseRadii(radii, false);
    const normalizedDate = parseCampaignDate(campaign_date);
    const normalizedSortBy = parseSortBy(sort_by);

    let searchResult;

    if (coords && radiiList.length > 0) {
      // 반경 조회
      searchResult = await searchNearby({
        address: address || '',
        lat: coords.lat,
        lng: coords.lng,
        radii: radiiList,
        districts: districtsList,
        require_ev: Boolean(require_ev),
        sort_by: normalizedSortBy,
        advertiser_industry,
        campaign_date: normalizedDate,
        advertiser_name,
        campaign_name,
      });
    } else if (districtsList.length > 0) {
      // 지역별 조회
      searchResult = await searchByDistrict({
        districts: districtsList,
        require_ev: Boolean(require_ev),
        sort_by: normalizedSortBy,
        advertiser_industry,
        campaign_date: normalizedDate,
      });
    } else {
      return NextResponse.json({ error: '좌표+반경 또는 지역을 지정해주세요' }, { status: 400 });
    }

    // excluded_ids 필터링
    const excludedIds = Array.isArray(body.excluded_ids) ? new Set(body.excluded_ids.map(String)) : new Set<string>();
    if (excludedIds.size > 0) {
      searchResult.results = searchResult.results.filter(r => !excludedIds.has(r.id));
      // 합계 재계산
      const avail = searchResult.results.filter(r => r.restriction_status === 'available');
      searchResult.total_count = avail.length;
      searchResult.total_households = avail.reduce((s, c) => s + (c.households || 0), 0);
      searchResult.total_units = avail.reduce((s, c) => s + (c.units || 0), 0);
      searchResult.total_price_4w = avail.reduce((s, c) => s + (c.price_4w || 0), 0);
    }

    const excludedColumnsArr = Array.isArray(body.excluded_columns) ? body.excluded_columns.map(String).filter(Boolean) : [];
    const excludedColumns: Set<string> = new Set(excludedColumnsArr);

    const excelBuffer = await generateExcel(searchResult, advertiser_name, campaign_name, {
      advertiser_name,
      advertiser_industry,
      campaign_name,
      message: creative_message,
      preferred_format: creative_format,
      audio_mode: creative_audio_mode,
      asset_kinds: Array.isArray(creative_asset_kinds)
        ? creative_asset_kinds.map(String) as Array<'store' | 'food' | 'interior' | 'staff' | 'product' | 'before_after' | 'none'>
        : [],
    }, excludedColumns);

    void appendActivityLog({
      action: 'excel',
      address: address || searchResult.center.address || '',
      radii: radiiList,
      resultCount: searchResult.total_count,
      advertiserName: advertiser_name || '',
      campaignName: campaign_name || '',
      ip: getClientIp(req.headers),
    }).catch(() => {});

    const filename = `포커스미디어_견적서_${sanitizeFilenameSegment(address || searchResult.center.address || 'output')}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: `견적서 생성 실패: ${e}` }, { status: 500 });
  }
}
