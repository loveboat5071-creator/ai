/**
 * 지역 + 업종 기반 업체 검색 API
 * 카카오 Local API — 이중 모드: 카테고리 검색 (좌표 기반 그리드) + 키워드 검색
 * 카테고리 검색 시 3x3 그리드로 분할하여 45건 제한 우회
 * MINING_API_KEY로 출처 검증 (FocusMap 전용)
 */
import { NextRequest, NextResponse } from 'next/server';

const KAKAO_API_KEY = process.env.KAKAO_API_KEY;
const MINING_API_KEY = process.env.MINING_API_KEY;

interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  place_url: string;
}

interface KakaoSearchResponse {
  documents: KakaoPlace[];
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
}

interface MappedBusiness {
  id: string;
  name: string;
  category: string;
  categoryGroup: string;
  phone: string;
  address: string;
  addressJibun: string;
  lat: number;
  lng: number;
  placeUrl: string;
  homepageUrl: null;
  emails: string[];
  status: string;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Mining-Key',
  };
}

function verifyMiningKey(req: NextRequest): boolean {
  if (!MINING_API_KEY) return true;
  const key = req.headers.get('x-mining-key') || '';
  return key === MINING_API_KEY;
}

/** Geocode a region name to coordinates */
async function geocodeRegion(region: string): Promise<{ x: number; y: number } | null> {
  const url = new URL('https://dapi.kakao.com/v2/local/search/address.json');
  url.searchParams.set('query', region);
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (data.documents?.length > 0) {
    return { x: parseFloat(data.documents[0].x), y: parseFloat(data.documents[0].y) };
  }
  // Fallback: keyword search
  const kwUrl = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  kwUrl.searchParams.set('query', region);
  kwUrl.searchParams.set('size', '1');
  const kwResp = await fetch(kwUrl.toString(), {
    headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
  });
  if (!kwResp.ok) return null;
  const kwData = await kwResp.json();
  if (kwData.documents?.length > 0) {
    return { x: parseFloat(kwData.documents[0].x), y: parseFloat(kwData.documents[0].y) };
  }
  return null;
}

function mapPlace(place: KakaoPlace): MappedBusiness {
  return {
    id: place.id,
    name: place.place_name,
    category: place.category_name,
    categoryGroup: place.category_group_name,
    phone: place.phone || '',
    address: place.road_address_name || place.address_name,
    addressJibun: place.address_name,
    lat: parseFloat(place.y),
    lng: parseFloat(place.x),
    placeUrl: place.place_url,
    homepageUrl: null,
    emails: [],
    status: 'pending',
  };
}

/** Fetch all pages for a single Kakao category search (up to 45 results) */
async function fetchAllPages(
  categoryGroupCode: string,
  x: number,
  y: number,
  radius: number
): Promise<KakaoPlace[]> {
  const allPlaces: KakaoPlace[] = [];
  let page = 1;
  let isEnd = false;

  while (!isEnd && page <= 3) {
    const url = new URL('https://dapi.kakao.com/v2/local/search/category.json');
    url.searchParams.set('category_group_code', categoryGroupCode);
    url.searchParams.set('x', String(x));
    url.searchParams.set('y', String(y));
    url.searchParams.set('radius', String(radius));
    url.searchParams.set('sort', 'distance');
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', '15');

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
    });
    if (!resp.ok) break;

    const data: KakaoSearchResponse = await resp.json();
    allPlaces.push(...data.documents);
    isEnd = data.meta.is_end;
    page++;
  }

  return allPlaces;
}

/** Generate 3x3 grid points around center within a given spread (meters) */
function generateGridPoints(cx: number, cy: number, spreadKm: number): { x: number; y: number }[] {
  // 1 degree latitude ≈ 111km, 1 degree longitude ≈ 88km (at Korea's latitude ~37°)
  const latDeg = spreadKm / 111;
  const lngDeg = spreadKm / 88;
  const offsets = [-1, 0, 1];
  const points: { x: number; y: number }[] = [];
  for (const dy of offsets) {
    for (const dx of offsets) {
      points.push({
        x: cx + dx * lngDeg,
        y: cy + dy * latDeg,
      });
    }
  }
  return points;
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyMiningKey(req)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mining API key' },
        { status: 403, headers: corsHeaders() }
      );
    }

    if (!KAKAO_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'KAKAO_API_KEY not configured' },
        { status: 500, headers: corsHeaders() }
      );
    }

    const body = await req.json();
    const { region, category, categoryGroupCode, searchMode = 'keyword', page = 1 } = body;

    if (!region) {
      return NextResponse.json(
        { success: false, error: 'region is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const size = 15;

    if (searchMode === 'category' && categoryGroupCode) {
      // ===== CATEGORY SEARCH: Grid-based multi-point search =====
      const coords = await geocodeRegion(region);
      if (!coords) {
        return NextResponse.json(
          { success: false, error: `"${region}" 지역의 좌표를 찾을 수 없습니다.` },
          { status: 400, headers: corsHeaders() }
        );
      }

      // Generate 3x3 grid (spread 1.5km apart, each with 2km radius)
      const gridPoints = generateGridPoints(coords.x, coords.y, 1.5);
      const searchRadius = 2000; // 2km per point

      // Fetch all grid points in parallel
      const gridResults = await Promise.all(
        gridPoints.map(pt => fetchAllPages(categoryGroupCode, pt.x, pt.y, searchRadius))
      );

      // Deduplicate by place ID
      const seen = new Map<string, KakaoPlace>();
      for (const places of gridResults) {
        for (const place of places) {
          if (!seen.has(place.id)) {
            seen.set(place.id, place);
          }
        }
      }

      const allBusinesses = Array.from(seen.values()).map(mapPlace);
      const totalCount = allBusinesses.length;

      // Paginate
      const startIdx = (page - 1) * size;
      const pageBusinesses = allBusinesses.slice(startIdx, startIdx + size);
      const hasMore = startIdx + size < totalCount;

      return NextResponse.json(
        {
          success: true,
          businesses: pageBusinesses,
          totalCount,
          page,
          hasMore,
          region,
          category: categoryGroupCode,
        },
        { headers: corsHeaders() }
      );
    } else {
      // ===== KEYWORD SEARCH: Original behavior =====
      if (!category) {
        return NextResponse.json(
          { success: false, error: 'category is required for keyword search' },
          { status: 400, headers: corsHeaders() }
        );
      }

      const query = `${region} ${category}`;
      const kakaoUrl = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
      kakaoUrl.searchParams.set('query', query);
      kakaoUrl.searchParams.set('page', String(Math.min(Math.max(1, page), 45)));
      kakaoUrl.searchParams.set('size', String(size));

      const kakaoResp = await fetch(kakaoUrl.toString(), {
        headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
      });

      if (!kakaoResp.ok) {
        const errText = await kakaoResp.text();
        return NextResponse.json(
          { success: false, error: `Kakao API error: ${kakaoResp.status} ${errText}` },
          { status: 502, headers: corsHeaders() }
        );
      }

      const kakaoData: KakaoSearchResponse = await kakaoResp.json();

      return NextResponse.json(
        {
          success: true,
          businesses: kakaoData.documents.map(mapPlace),
          totalCount: kakaoData.meta.pageable_count,
          page,
          hasMore: !kakaoData.meta.is_end,
          region,
          category,
        },
        { headers: corsHeaders() }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Search failed: ${message}` },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}
