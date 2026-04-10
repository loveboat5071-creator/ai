import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import {
  RedisKeys,
  type LeadCore,
} from '@/lib/crm-types';
import { scrapeHomepage } from '@/lib/web-scraper';
import { applyHomepageEnrichmentToLead } from '@/lib/lead-enrichment';

export const dynamic = 'force-dynamic';

interface BulkEnrichRequest {
  leadIds?: string[];
}

interface BulkEnrichResult {
  leadId: string;
  success: boolean;
  homepageUrl?: string;
  pagesCrawled: number;
  emailsFound: number;
  phonesFound: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkEnrichRequest = await request.json();
    const leadIds = Array.isArray(body.leadIds) ? body.leadIds : [];

    if (leadIds.length === 0) {
      return NextResponse.json({ error: 'leadIds is required' }, { status: 400 });
    }

    const uniqueLeadIds = Array.from(new Set(leadIds)).slice(0, 50);
    const results: BulkEnrichResult[] = [];

    for (const leadId of uniqueLeadIds) {
      const lead = await redis.get<LeadCore>(RedisKeys.leadCore(leadId));

      if (!lead) {
        results.push({
          leadId,
          success: false,
          pagesCrawled: 0,
          emailsFound: 0,
          phonesFound: 0,
          error: 'Lead not found',
        });
        continue;
      }

      const homepageUrl = lead.ai_analysis.homepage_url;
      if (!homepageUrl) {
        results.push({
          leadId,
          success: false,
          pagesCrawled: 0,
          emailsFound: 0,
          phonesFound: 0,
          error: 'Homepage URL not found',
        });
        continue;
      }

      const scrapedInfo = await scrapeHomepage(homepageUrl, 15000);

      const updatedLead = applyHomepageEnrichmentToLead(lead, scrapedInfo);

      await redis.set(RedisKeys.leadCore(leadId), updatedLead);

      results.push({
        leadId,
        success: scrapedInfo.success,
        homepageUrl,
        pagesCrawled: scrapedInfo.pages_crawled,
        emailsFound: scrapedInfo.emails.length,
        phonesFound: scrapedInfo.phones.length,
        error: scrapedInfo.error,
      });
    }

    const successCount = results.filter((item) => item.success).length;

    return NextResponse.json({
      success: true,
      total: uniqueLeadIds.length,
      successCount,
      failureCount: uniqueLeadIds.length - successCount,
      results,
    });
  } catch (error) {
    console.error('Error in bulk enrich:', error);
    return NextResponse.json(
      { error: 'Failed to bulk enrich leads' },
      { status: 500 }
    );
  }
}
