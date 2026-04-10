import { NextRequest, NextResponse } from 'next/server';

import { scrapeHomepage } from '@/lib/web-scraper';

const MINING_API_KEY = process.env.MINING_API_KEY;
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

const BLOCKED_DOMAINS = [
  'naver.com',
  'kakao.com',
  'daum.net',
  'google.com',
  'bing.com',
  'pstatic.net',
  'tistory.com',
  'youtube.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'namu.wiki',
  'wikipedia.org',
  'place.map.kakao.com',
  'map.kakao.com',
  'map.naver.com',
  'm.place.naver.com',
  'store.naver.com',
  'smartplace.naver.com',
  'booking.naver.com',
  'modoodoc.com',
  'mediup.co.kr',
  'hira.or.kr',
  'blog.naver.com',
  'cafe.naver.com',
  'post.naver.com',
  'pf.kakao.com',
];

interface EnrichRequest {
  placeId: string;
  name: string;
  region?: string;
}

export interface EnrichResult {
  placeId: string;
  name: string;
  homepageUrl: string | null;
  emails: string[];
}

interface NaverLocalItem {
  title: string;
  link: string;
}

interface NaverWebItem {
  title: string;
  link: string;
  description: string;
}

interface HomepageCandidate {
  url: string;
  title: string;
  source: 'local' | 'web';
  rank: number;
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

function normalizeDomain(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase();
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBusinessTokens(businessName: string): string[] {
  const compact = businessName
    .toLowerCase()
    .replace(/\(주\)|주식회사|유한회사|합자회사|법인|co\.?|ltd\.?|inc\.?|corp\.?|company/gi, ' ')
    .replace(/[^a-z0-9가-힣]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = compact
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  const merged = compact.replace(/\s+/g, '');
  if (merged.length >= 2) tokens.push(merged);

  return Array.from(new Set(tokens));
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeDomain(hostname);
  return BLOCKED_DOMAINS.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

function normalizeHomepage(url: string): string | null {
  if (!url || url.trim() === '') return null;

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (isBlockedHostname(parsed.hostname)) return null;
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function scoreCandidate(candidate: HomepageCandidate, businessName: string): number {
  const tokens = normalizeBusinessTokens(businessName);
  const url = candidate.url.toLowerCase();
  const title = decodeHtml(candidate.title).toLowerCase();
  const pathname = (() => {
    try {
      return new URL(candidate.url).pathname.toLowerCase();
    } catch {
      return '/';
    }
  })();

  let score = candidate.source === 'local' ? 70 : 50;
  score += Math.max(0, 20 - candidate.rank * 2);

  for (const token of tokens) {
    if (url.includes(token)) score += 18;
    if (title.includes(token)) score += 12;
  }

  if (pathname === '/' || pathname === '') score += 12;
  if (pathname.includes('contact') || pathname.includes('about') || pathname.includes('company')) score -= 4;

  return score;
}

async function fetchNaverJson<T>(endpoint: string, query: string): Promise<T | null> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return null;

  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(`https://openapi.naver.com/v1/search/${endpoint}.json?query=${encodedQuery}&display=8`, {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function discoverHomepageCandidates(businessName: string, region: string): Promise<HomepageCandidate[]> {
  const queries = [
    `${businessName} ${region}`.trim(),
    `${businessName} ${region} 홈페이지`.trim(),
    `${businessName} 홈페이지`.trim(),
    businessName.trim(),
  ].filter(Boolean);

  const uniqueQueries = Array.from(new Set(queries));
  const candidateMap = new Map<string, HomepageCandidate>();

  for (const query of uniqueQueries) {
    const [localData, webData] = await Promise.all([
      fetchNaverJson<{ items?: NaverLocalItem[] }>('local', query),
      fetchNaverJson<{ items?: NaverWebItem[] }>('webkr', query),
    ]);

    const localItems = localData?.items || [];
    localItems.forEach((item, index) => {
      const normalized = normalizeHomepage(item.link);
      if (!normalized) return;
      const existing = candidateMap.get(normalized);
      const nextCandidate: HomepageCandidate = {
        url: normalized,
        title: item.title,
        source: 'local',
        rank: index,
      };
      if (!existing || scoreCandidate(nextCandidate, businessName) > scoreCandidate(existing, businessName)) {
        candidateMap.set(normalized, nextCandidate);
      }
    });

    const webItems = webData?.items || [];
    webItems.forEach((item, index) => {
      const normalized = normalizeHomepage(item.link);
      if (!normalized) return;
      const existing = candidateMap.get(normalized);
      const nextCandidate: HomepageCandidate = {
        url: normalized,
        title: `${item.title} ${item.description || ''}`,
        source: 'web',
        rank: index,
      };
      if (!existing || scoreCandidate(nextCandidate, businessName) > scoreCandidate(existing, businessName)) {
        candidateMap.set(normalized, nextCandidate);
      }
    });

    if (candidateMap.size >= 4) break;
  }

  return Array.from(candidateMap.values())
    .sort((a, b) => scoreCandidate(b, businessName) - scoreCandidate(a, businessName))
    .slice(0, 4);
}

function scoreScrapeResult(args: {
  candidate: HomepageCandidate;
  emails: string[];
  phones: string[];
  contactPages: string[];
  pagesCrawled: number;
  success: boolean;
}): number {
  const { candidate, emails, phones, contactPages, pagesCrawled, success } = args;
  let score = success ? 30 : 0;
  score += emails.length * 120;
  score += phones.length * 15;
  score += contactPages.length * 25;
  score += pagesCrawled * 3;
  score += candidate.source === 'local' ? 8 : 0;
  return score;
}

async function enrichOne(
  biz: { placeId: string; name: string; region?: string },
  region: string,
): Promise<EnrichResult> {
  const candidates = await discoverHomepageCandidates(biz.name, biz.region || region);
  if (candidates.length === 0) {
    return { placeId: biz.placeId, name: biz.name, homepageUrl: null, emails: [] };
  }

  let best: { homepageUrl: string; emails: string[]; score: number } | null = null;

  for (const candidate of candidates) {
    const scraped = await scrapeHomepage(candidate.url, 6000, { maxPages: 8 });
    const score = scoreScrapeResult({
      candidate,
      emails: scraped.emails,
      phones: scraped.phones,
      contactPages: scraped.contact_pages,
      pagesCrawled: scraped.pages_crawled,
      success: scraped.success,
    });

    if (!best || score > best.score) {
      best = {
        homepageUrl: candidate.url,
        emails: scraped.emails.slice(0, 5),
        score,
      };
    }

    if (scraped.emails.length > 0) {
      break;
    }
  }

  return {
    placeId: biz.placeId,
    name: biz.name,
    homepageUrl: best?.homepageUrl || candidates[0]?.url || null,
    emails: best?.emails || [],
  };
}

export async function enrichBusiness(
  placeId: string,
  name: string,
  region: string,
): Promise<{ homepageUrl: string | null; emails: string[] }> {
  const result = await enrichOne({ placeId, name }, region);
  return { homepageUrl: result.homepageUrl, emails: result.emails };
}

export async function handleMiningEnrichPost(req: NextRequest) {
  try {
    if (!verifyMiningKey(req)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mining API key' },
        { status: 403, headers: corsHeaders() },
      );
    }

    const body = await req.json();
    const { businesses, region = '' } = body as { businesses: EnrichRequest[]; region?: string };

    if (!businesses || businesses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No businesses provided' },
        { status: 400, headers: corsHeaders() },
      );
    }

    const batch = businesses.slice(0, 10);
    const results: EnrichResult[] = [];
    const concurrency = 3;

    for (let i = 0; i < batch.length; i += concurrency) {
      const chunk = batch.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map((biz) => enrichOne({ placeId: biz.placeId, name: biz.name, region: biz.region }, region)),
      );
      results.push(...chunkResults);
    }

    const enrichedCount = results.filter((item) => item.homepageUrl || item.emails.length > 0).length;
    const emailCount = results.filter((item) => item.emails.length > 0).length;
    console.log(`[Mining Enrich] ${enrichedCount}/${results.length} enriched, ${emailCount} with emails`);

    return NextResponse.json(
      { success: true, results, enrichedCount, totalCount: results.length },
      { headers: corsHeaders() },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Enrichment failed: ${message}` },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export function handleMiningEnrichOptions() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}
