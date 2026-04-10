/**
 * API Endpoint: Enrich lead with homepage information
 * POST /api/sales/leads/[leadId]/enrich
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { RedisKeys, type LeadCore } from '@/lib/crm-types';
import { scrapeHomepage } from '@/lib/web-scraper';
import { applyHomepageEnrichmentToLead } from '@/lib/lead-enrichment';

/**
 * POST /api/sales/leads/[leadId]/enrich
 * Crawl the lead's homepage and enrich with contact information
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    // Get lead from Redis
    const leadKey = RedisKeys.leadCore(leadId);
    const leadData = await redis.get(leadKey);

    if (!leadData) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    const lead = leadData as LeadCore;

    // Check if homepage URL exists
    const homepageUrl = lead.ai_analysis.homepage_url;
    if (!homepageUrl) {
      return NextResponse.json(
        { error: 'Homepage URL not found in lead' },
        { status: 400 }
      );
    }

    // Scrape the homepage
    console.log(`[Enrich] Scraping homepage: ${homepageUrl}`);
    const scrapedInfo = await scrapeHomepage(homepageUrl, 15000);

    const updatedLead = applyHomepageEnrichmentToLead(lead, scrapedInfo);

    // Save updated lead
    await redis.set(leadKey, updatedLead);

    console.log(
      `[Enrich] Successfully enriched lead ${leadId} - Found ${scrapedInfo.emails.length} emails, ${scrapedInfo.phones.length} phones from ${scrapedInfo.pages_crawled} pages`
    );

    return NextResponse.json({
      success: true,
      enrichment: updatedLead.enrichment,
      lead_id: leadId,
    });

  } catch (error) {
    console.error('[Enrich] Error enriching lead:', error);
    return NextResponse.json(
      {
        error: 'Failed to enrich lead',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
