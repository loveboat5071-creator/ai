/**
 * 홈페이지 크롤링 API — 업체 URL에서 이메일/전화번호 추출
 * MINING_API_KEY로 출처 검증 (FocusMap 전용)
 */
import { NextRequest, NextResponse } from 'next/server';
import { scrapeHomepage } from '@/lib/web-scraper';
import { buildHomepageEnrichment } from '@/lib/lead-enrichment';

const MINING_API_KEY = process.env.MINING_API_KEY;

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

export async function POST(req: NextRequest) {
  try {
    if (!verifyMiningKey(req)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mining API key' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await req.json();
    const { url, placeUrl } = body;

    const targetUrl = url || placeUrl;
    if (!targetUrl) {
      return NextResponse.json(
        { success: false, error: 'url or placeUrl is required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const scrapedInfo = await scrapeHomepage(targetUrl, 12000, { maxPages: 3 });
    const enrichment = buildHomepageEnrichment(scrapedInfo);

    return NextResponse.json(
      {
        success: true,
        enrichment: {
          emails: enrichment.emails,
          phones: enrichment.phones,
          title: enrichment.title,
          description: enrichment.description,
          companyOverview: enrichment.company_overview,
          keyServices: enrichment.key_services,
          keyMessages: enrichment.key_messages,
          contactConfidence: enrichment.contact_confidence,
          pagesCrawled: enrichment.pages_crawled,
          primaryEmail: enrichment.primary_email,
          primaryPhone: enrichment.primary_phone,
        },
      },
      { headers: corsHeaders() }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Crawl failed: ${message}` },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}
