import { type HomepageEnrichment, type LeadCore } from './crm-types';
import { type ScrapedInfo } from './web-scraper';

export type ContactConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

const DEFAULT_ENRICHMENT_STALE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function inferContactConfidence(scrapedInfo: ScrapedInfo): ContactConfidence {
  if (!scrapedInfo.success) return 'LOW';

  const contactHits = scrapedInfo.emails.length + scrapedInfo.phones.length;
  const contactPageCount = scrapedInfo.contact_pages.length;

  if (contactHits >= 2 && contactPageCount >= 1) return 'HIGH';
  if (contactHits >= 1 || scrapedInfo.pages_crawled >= 3) return 'MEDIUM';
  return 'LOW';
}

export function buildHomepageEnrichment(scrapedInfo: ScrapedInfo): HomepageEnrichment {
  const primaryEmail = scrapedInfo.emails[0] || null;
  const primaryPhone = scrapedInfo.phones[0] || null;

  return {
    emails: scrapedInfo.emails,
    phones: scrapedInfo.phones,
    description: scrapedInfo.description || scrapedInfo.og_description,
    title: scrapedInfo.title || scrapedInfo.og_title,
    scraped_at: Date.now(),
    success: scrapedInfo.success,
    error: scrapedInfo.error,
    pages_crawled: scrapedInfo.pages_crawled,
    crawled_urls: scrapedInfo.crawled_urls,
    contact_pages: scrapedInfo.contact_pages,
    company_overview: scrapedInfo.company_overview,
    key_services: scrapedInfo.key_services,
    key_messages: scrapedInfo.key_messages,
    evidence_snippets: scrapedInfo.evidence_snippets,
    contact_confidence: inferContactConfidence(scrapedInfo),
    primary_email: primaryEmail,
    primary_phone: primaryPhone,
  };
}

export function applyHomepageEnrichmentToLead(
  lead: LeadCore,
  scrapedInfo: ScrapedInfo
): LeadCore {
  const enrichment = buildHomepageEnrichment(scrapedInfo);

  const updatedLead: LeadCore = {
    ...lead,
    enrichment,
    updated_at: Date.now(),
    contact: {
      ...(lead.contact || {}),
    },
  };

  const hadEmail = Boolean(updatedLead.contact?.email);
  const hadPhone = Boolean(updatedLead.contact?.phone);

  if (!hadEmail && enrichment.primary_email) {
    updatedLead.contact!.email = enrichment.primary_email;
  }

  if (!hadPhone && enrichment.primary_phone) {
    updatedLead.contact!.phone = enrichment.primary_phone;
  }

  const filledFromHomepage =
    (!hadEmail && Boolean(enrichment.primary_email)) ||
    (!hadPhone && Boolean(enrichment.primary_phone));

  if (filledFromHomepage && updatedLead.contact?.source !== 'MANUAL') {
    updatedLead.contact!.source = 'HOMEPAGE';
  }

  return updatedLead;
}

export function shouldRefreshHomepageEnrichment(
  lead: LeadCore,
  maxStaleMs: number = DEFAULT_ENRICHMENT_STALE_MS
): boolean {
  if (!lead.ai_analysis?.homepage_url) return false;

  const enrichment = lead.enrichment;
  if (!enrichment) return true;
  if (!enrichment.success) return true;

  if (!enrichment.scraped_at || Date.now() - enrichment.scraped_at > maxStaleMs) {
    return true;
  }

  const hasInsight =
    (enrichment.key_services?.length || 0) > 0 ||
    (enrichment.key_messages?.length || 0) > 0 ||
    (enrichment.company_overview || '').trim().length > 0;

  return !hasInsight;
}
