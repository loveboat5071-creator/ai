/**
 * 광고주 후보 일괄 전송 API
 * FocusMap 마이닝에서 선택한 업체들을 CRM 파이프라인에 저장 + 홈페이지/이메일 인리치먼트
 */
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import {
  RedisKeys,
  LeadStatus,
  generateLeadId,
  type LeadCore,
  type LeadState,
} from '@/lib/crm-types';
import { enrichBusiness } from '@/app/api/mining/enrich/business';

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

interface MinedBusiness {
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
  homepageUrl: string | null;
  emails: string[];
}

function getSubCategory(cat: string): string {
  if (cat.includes('>')) return cat.split('>').pop()?.trim() || cat;
  return cat;
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
    const { region, category, businesses } = body as {
      region: string;
      category: string;
      businesses: MinedBusiness[];
    };

    if (!businesses || businesses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No businesses provided' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const now = Date.now();
    const results: { id: string; name: string; stored: boolean; homepageUrl?: string | null; emails?: string[] }[] = [];

    for (const biz of businesses) {
      try {
        const leadId = generateLeadId(`FOCUS_MEDIA:focusmap:${biz.id}`);
        const subCategory = getSubCategory(biz.category);

        // Run enrichment to find real homepage + emails
        let homepageUrl = biz.homepageUrl || null;
        let emails = biz.emails || [];

        // Only enrich if we don't already have homepage/emails from client
        if (!homepageUrl || emails.length === 0) {
          try {
            const enriched = await enrichBusiness(biz.id, biz.name, region);
            if (!homepageUrl && enriched.homepageUrl) homepageUrl = enriched.homepageUrl;
            if (emails.length === 0 && enriched.emails.length > 0) emails = enriched.emails;
          } catch (e) {
            console.error(`[Mining Leads] Enrichment failed for ${biz.name}:`, e);
          }
        }

        // Filter out Kakao Place URLs — they are NOT homepages
        if (homepageUrl && (homepageUrl.includes('place.map.kakao.com') || homepageUrl.includes('map.kakao.com'))) {
          homepageUrl = null;
        }

        const leadCore: LeadCore = {
          lead_id: leadId,
          media_type: 'FOCUS_MEDIA',
          title: biz.name,
          link: biz.placeUrl || `https://place.map.kakao.com/${biz.id}`,
          contentSnippet: [
            `\ud83c\udfe2 ${subCategory}`,
            `\ud83d\udccd ${biz.address || biz.addressJibun || region}`,
            biz.phone ? `\u260e ${biz.phone}` : null,
            homepageUrl ? `\ud83c\udf10 ${homepageUrl}` : null,
            emails.length > 0 ? `\ud83d\udce7 ${emails[0]}` : null,
          ].filter(Boolean).join('\n'),
          pubDate: new Date().toISOString(),
          source: 'FOCUSMAP_MINING',
          keyword: `FocusMap \u00b7 ${region} \u00b7 ${category || subCategory}`,
          ai_analysis: {
            company_name: biz.name,
            event_summary: `${region} ${subCategory} (\uce74\uce74\uc624\ub9f5 \ub9c8\uc774\ub2dd)`,
            target_audience: `${region} \uc9c0\uc5ed \uc544\ud30c\ud2b8 \uc8fc\ubbfc`,
            atv_fit_reason: `${biz.categoryGroup || subCategory} \uc5c5\uc885 - \uc9c0\uc5ed \ud0c0\uac8c\ud305 \uc801\ud569. \uc8fc\uc18c: ${biz.address}`,
            sales_angle: `${region} \uc9c0\uc5ed \uc544\ud30c\ud2b8 \uc5d8\ub9ac\ubca0\uc774\ud130 \uad11\uace0 \uc81c\uc548`,
            ai_score: 65,
            contact_email: emails[0] || null,
            contact_phone: biz.phone || null,
            pr_agency: null,
            homepage_url: homepageUrl,
          },
          contact: {
            email: emails[0],
            phone: biz.phone || undefined,
            homepage: homepageUrl || undefined,
            source: 'MANUAL',
          },
          final_score: 65,
          created_at: now,
          updated_at: now,
        };

        const leadState: LeadState = {
          lead_id: leadId,
          status: LeadStatus.NEW,
          tags: ['FocusMap', region, subCategory],
          status_changed_at: now,
        };

        const pipeline = redis.pipeline();
        pipeline.set(RedisKeys.leadCore(leadId), leadCore);
        pipeline.set(RedisKeys.leadState(leadId), leadState);
        pipeline.zadd(RedisKeys.idxAll(), { score: now, member: leadId });
        pipeline.zadd(RedisKeys.idxStatus(LeadStatus.NEW), { score: now, member: leadId });
        await pipeline.exec();

        results.push({ id: biz.id, name: biz.name, stored: true, homepageUrl, emails });
      } catch (err) {
        console.error(`[Mining Leads] Failed to store ${biz.name}:`, err);
        results.push({ id: biz.id, name: biz.name, stored: false });
      }
    }

    const storedCount = results.filter(r => r.stored).length;
    const enrichedCount = results.filter(r => r.homepageUrl || (r.emails && r.emails.length > 0)).length;
    console.log(`[Mining Leads] ${storedCount}/${businesses.length} stored, ${enrichedCount} enriched from ${region}`);

    return NextResponse.json(
      { success: true, storedCount, enrichedCount, totalCount: businesses.length, results },
      { headers: corsHeaders() }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Lead storage failed: ${message}` },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}
