/**
 * Web Scraper for Homepage Information Enrichment
 * Crawls company homepages to extract detailed information and contact details
 */

import * as cheerio from 'cheerio';
import { normalizeUrl } from './url-utils';

export interface ScrapedInfo {
  emails: string[];
  phones: string[];
  description: string | null;
  title: string | null;
  og_title: string | null;
  og_description: string | null;
  raw_text: string;
  pages_crawled: number;
  crawled_urls: string[];
  contact_pages: string[];
  company_overview: string | null;
  key_services: string[];
  key_messages: string[];
  evidence_snippets: string[];
  success: boolean;
  error?: string;
}

interface InternalLinkCandidate {
  url: string;
  priority: number;
}

interface PageSignals {
  url: string;
  title: string | null;
  description: string | null;
  og_title: string | null;
  og_description: string | null;
  rawText: string;
  emails: string[];
  phones: string[];
  contactLike: boolean;
  overviewCandidates: string[];
  serviceCandidates: string[];
  messageCandidates: string[];
  evidenceCandidates: string[];
  links: InternalLinkCandidate[];
}

const PAGE_TEXT_LIMIT = 5000;
const MERGED_TEXT_LIMIT = 8000;
const DEFAULT_MAX_PAGES = 5;
const EXCLUDED_PATH_HINTS = [
  '/privacy',
  '/terms',
  '/policy',
  '/login',
  '/signup',
  '/register',
  '/careers',
  '/recruit',
  '/notice',
  '/blog',
  '/news',
  '/faq',
];
const CONTACT_HINTS = [
  'contact',
  'contact-us',
  'contactus',
  '문의',
  '문의하기',
  '상담',
  '상담문의',
  '고객',
  '고객센터',
  '연락처',
  '전화문의',
  '제휴',
  '파트너',
  '입점',
  'support',
  'cs',
  'help',
  'location',
  'directions',
  '오시는길',
  '찾아오시는길',
];
const ABOUT_HINTS = [
  'about',
  'about-us',
  'aboutus',
  'company',
  '기업',
  '회사소개',
  '브랜드소개',
  '소개',
  '인사말',
  'organization',
];
const SERVICE_HINTS = ['service', 'product', 'solution', '브랜드', '사업', '제품', '서비스', '솔루션'];
const MESSAGE_HINTS = ['혁신', '가치', '고객', '비전', 'mission', 'vision', 'premium', '품질'];

function emptyScrapedInfo(error: string): ScrapedInfo {
  return {
    emails: [],
    phones: [],
    description: null,
    title: null,
    og_title: null,
    og_description: null,
    raw_text: '',
    pages_crawled: 0,
    crawled_urls: [],
    contact_pages: [],
    company_overview: null,
    key_services: [],
    key_messages: [],
    evidence_snippets: [],
    success: false,
    error,
  };
}

function normalizeHost(host: string): string {
  return host.replace(/^www\./i, '').toLowerCase();
}

function sameSite(hostA: string, hostB: string): boolean {
  return normalizeHost(hostA) === normalizeHost(hostB);
}

function normalizePhone(phone: string): string {
  const digitsOnly = phone.replace(/[^\d]/g, '');
  if (!digitsOnly) return phone;

  if (digitsOnly.length === 11) {
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 7)}-${digitsOnly.slice(7)}`;
  }
  if (digitsOnly.length === 10) {
    if (digitsOnly.startsWith('02')) {
      return `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2, 6)}-${digitsOnly.slice(6)}`;
    }
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
  return phone.replace(/\s+/g, '-');
}

function cleanLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function uniqueLines(values: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const line = cleanLine(value);
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
    if (result.length >= limit) break;
  }

  return result;
}

function hasAnyKeyword(value: string, keywords: string[]): boolean {
  const target = value.toLowerCase();
  return keywords.some((keyword) => target.includes(keyword.toLowerCase()));
}

function splitToSentenceLikeLines(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/[.!?]\s+|\n+/)
    .map(cleanLine)
    .filter((line) => line.length >= 16 && line.length <= 180);
}

function scoreEmail(email: string, rootHost: string): number {
  const normalized = email.toLowerCase();
  const [localPart = '', domain = ''] = normalized.split('@');
  let score = 0;

  const positiveLocal = ['biz', 'b2b', 'marketing', 'sales', 'partner', 'partnership', 'contact', 'hello', 'info'];
  const negativeLocal = ['noreply', 'no-reply', 'do-not-reply', 'donotreply', 'webmaster', 'admin'];
  const disposableDomains = ['gmail.com', 'naver.com', 'daum.net', 'hotmail.com', 'outlook.com'];

  if (sameSite(domain, rootHost) || domain.endsWith(`.${normalizeHost(rootHost)}`)) score += 25;
  if (positiveLocal.some((token) => localPart.includes(token))) score += 20;
  if (negativeLocal.some((token) => localPart.includes(token))) score -= 40;
  if (disposableDomains.includes(domain)) score -= 10;
  if (localPart.length <= 2) score -= 5;

  return score;
}

function rankEmails(emails: string[], rootHost: string): string[] {
  const unique = Array.from(new Set(emails.map((item) => item.toLowerCase())));
  return unique
    .map((email) => ({ email, score: scoreEmail(email, rootHost) }))
    .sort((a, b) => b.score - a.score || a.email.localeCompare(b.email))
    .map((item) => item.email);
}

function scorePhone(phone: string): number {
  const digits = phone.replace(/[^\d]/g, '');
  let score = 0;

  if (digits.startsWith('1588') || digits.startsWith('1577') || digits.startsWith('1644') || digits.startsWith('1661')) {
    score += 20;
  }
  if (digits.startsWith('02')) score += 10;
  if (digits.startsWith('010')) score -= 10;
  if (digits.length < 9 || digits.length > 11) score -= 15;

  return score;
}

function rankPhones(phones: string[]): string[] {
  const normalized = Array.from(new Set(phones.map(normalizePhone)));
  return normalized
    .map((phone) => ({ phone, score: scorePhone(phone) }))
    .sort((a, b) => b.score - a.score || a.phone.localeCompare(b.phone))
    .map((item) => item.phone);
}

function linkPriority(linkText: string, path: string): number {
  const target = `${linkText} ${path}`.toLowerCase();
  let score = 0;

  if (CONTACT_HINTS.some((hint) => target.includes(hint))) score += 120;
  if (ABOUT_HINTS.some((hint) => target.includes(hint))) score += 80;
  if (SERVICE_HINTS.some((hint) => target.includes(hint))) score += 60;
  if (EXCLUDED_PATH_HINTS.some((hint) => path.includes(hint))) score -= 40;

  if (path === '/' || path === '') score -= 20;
  if (/(\.pdf|\.png|\.jpg|\.jpeg|\.gif|\.svg|\.zip)$/i.test(path)) score -= 200;

  return score;
}

function extractInternalLinks(
  $: cheerio.CheerioAPI,
  currentUrl: string,
  rootHost: string
): InternalLinkCandidate[] {
  const linkMap = new Map<string, number>();

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    const linkText = cleanLine($(el).text()).slice(0, 60);
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      return;
    }

    try {
      const absolute = new URL(href, currentUrl);
      if (!['http:', 'https:'].includes(absolute.protocol)) return;
      if (!sameSite(absolute.hostname, rootHost)) return;
      absolute.hash = '';
      const finalUrl = absolute.toString();
      const score = linkPriority(linkText, absolute.pathname.toLowerCase());
      if (score < -100) return;

      const existing = linkMap.get(finalUrl);
      if (existing === undefined || score > existing) {
        linkMap.set(finalUrl, score);
      }
    } catch {
      // Ignore malformed URLs.
    }
  });

  return Array.from(linkMap.entries())
    .map(([url, priority]) => ({ url, priority }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 30);
}

function pickOverview(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const line = cleanLine(candidate);
    if (!line) continue;
    if (line.length < 24 || line.length > 220) continue;
    if (extractEmails(line).length > 0 || extractPhones(line).length > 0) continue;
    return line;
  }
  return null;
}

function analyzePage(
  html: string,
  currentUrl: string,
  rootHost: string
): PageSignals {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, svg').remove();

  const title = cleanLine($('title').text()) || null;
  const description = cleanLine($('meta[name="description"]').attr('content') || '') || null;
  const ogTitle = cleanLine($('meta[property="og:title"]').attr('content') || '') || null;
  const ogDescription = cleanLine($('meta[property="og:description"]').attr('content') || '') || null;
  const rawText = cleanLine($('body').text()).slice(0, PAGE_TEXT_LIMIT);
  const footerText = cleanLine($('footer, [class*="footer"], [id*="footer"], [class*="contact"], [id*="contact"]').text());
  const searchText = `${html}\n${rawText}\n${footerText}`;

  const headingTexts = $('h1, h2')
    .map((_, el) => cleanLine($(el).text()))
    .get()
    .filter((line) => line.length >= 4 && line.length <= 120)
    .slice(0, 20);
  const paragraphTexts = $('p, li')
    .map((_, el) => cleanLine($(el).text()))
    .get()
    .filter((line) => line.length >= 16 && line.length <= 180)
    .slice(0, 120);

  const sentenceLines = splitToSentenceLikeLines(rawText).slice(0, 80);
  const serviceCandidates = [
    ...paragraphTexts.filter((line) => hasAnyKeyword(line, SERVICE_HINTS)),
    ...headingTexts.filter((line) => hasAnyKeyword(line, SERVICE_HINTS)),
  ];
  const messageCandidates = [
    ...headingTexts,
    ...sentenceLines.filter((line) => hasAnyKeyword(line, MESSAGE_HINTS)),
  ];
  const evidenceCandidates = [
    ...sentenceLines.filter((line) => hasAnyKeyword(line, [...SERVICE_HINTS, ...MESSAGE_HINTS, ...CONTACT_HINTS])),
    ...paragraphTexts.filter((line) => hasAnyKeyword(line, [...SERVICE_HINTS, ...CONTACT_HINTS])),
  ];

  const contactLike =
    hasAnyKeyword(currentUrl, CONTACT_HINTS) ||
    hasAnyKeyword(rawText, CONTACT_HINTS) ||
    extractEmails(searchText).length > 0 ||
    extractPhones(searchText).length > 0;

  return {
    url: currentUrl,
    title,
    description,
    og_title: ogTitle,
    og_description: ogDescription,
    rawText,
    emails: extractEmails(searchText),
    phones: extractPhones(searchText),
    contactLike,
    overviewCandidates: [ogDescription || '', description || '', ...headingTexts, ...sentenceLines],
    serviceCandidates,
    messageCandidates,
    evidenceCandidates,
    links: extractInternalLinks($, currentUrl, rootHost),
  };
}

/**
 * Extract all email addresses from text using comprehensive regex
 * @param text - Text to search for emails
 * @returns Array of unique email addresses
 */
export function extractEmails(text: string): string[] {
  const emailRegex = /([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const matches = text.match(emailRegex) || [];

  const uniqueEmails = Array.from(new Set(matches))
    .filter((email) => {
      if (email.endsWith('.png') || email.endsWith('.jpg') || email.endsWith('.gif')) {
        return false;
      }
      if (email.includes('example.com') || email.includes('test.com') || email.includes('yourdomain.com')) {
        return false;
      }
      return true;
    })
    .map((email) => email.toLowerCase());

  return uniqueEmails;
}

/**
 * Extract all Korean phone numbers from text
 * @param text - Text to search for phone numbers
 * @returns Array of unique phone numbers
 */
export function extractPhones(text: string): string[] {
  const phoneRegex = /((?:\+82[-\s]?)?(?:0\d{1,2}|1[5-9]\d{2})[-\s]?\d{3,4}[-\s]?\d{4})/g;
  const matches = text.match(phoneRegex) || [];

  return Array.from(new Set(matches.map((phone) => normalizePhone(phone))));
}

/**
 * Scrape a webpage for contact information and content
 * @param url - The URL to scrape (will be normalized if needed)
 * @param timeout - Request timeout in milliseconds (default: 10000)
 * @param options - Crawl options
 * @returns Scraped information or error
 */
export async function scrapeHomepage(
  url: string,
  timeout: number = 10000,
  options?: { maxPages?: number }
): Promise<ScrapedInfo> {
  const maxPages = Math.max(1, Math.min(options?.maxPages ?? DEFAULT_MAX_PAGES, 10));

  try {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
      return emptyScrapedInfo('Invalid URL format');
    }

    const rootHost = new URL(normalizedUrl).hostname;
    const queue: InternalLinkCandidate[] = [{ url: normalizedUrl, priority: 1000 }];
    const visited = new Set<string>();
    const pages: PageSignals[] = [];
    const allEmails: string[] = [];
    const allPhones: string[] = [];
    const contactPages = new Set<string>();
    const allOverviews: string[] = [];
    const allServiceCandidates: string[] = [];
    const allMessageCandidates: string[] = [];
    const allEvidenceCandidates: string[] = [];
    let firstFailure: string | null = null;

    while (queue.length > 0 && pages.length < maxPages) {
      queue.sort((a, b) => b.priority - a.priority);
      const current = queue.shift();
      if (!current) break;

      if (visited.has(current.url)) continue;
      visited.add(current.url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(current.url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; KOBACO-Bot/1.0; +https://kobaco-addr.vercel.app)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          },
          redirect: 'follow',
        });

        if (!response.ok) {
          firstFailure = firstFailure || `HTTP ${response.status}: ${response.statusText}`;
          continue;
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.includes('text/html')) {
          continue;
        }

        const html = await response.text();
        const finalUrl = response.url || current.url;
        const page = analyzePage(html, finalUrl, rootHost);
        pages.push(page);
        allEmails.push(...page.emails);
        allPhones.push(...page.phones);
        allOverviews.push(...page.overviewCandidates);
        allServiceCandidates.push(...page.serviceCandidates);
        allMessageCandidates.push(...page.messageCandidates);
        allEvidenceCandidates.push(...page.evidenceCandidates);

        if (page.contactLike) {
          contactPages.add(page.url);
        }

        for (const link of page.links) {
          if (visited.has(link.url)) continue;
          if (!queue.some((item) => item.url === link.url)) {
            queue.push(link);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          firstFailure = firstFailure || 'Request timeout';
        } else if (error instanceof Error) {
          firstFailure = firstFailure || error.message;
        } else {
          firstFailure = firstFailure || 'Unknown fetch error';
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (pages.length === 0) {
      return emptyScrapedInfo(firstFailure || 'Failed to fetch homepage');
    }

    const rankedEmails = rankEmails(allEmails, rootHost);
    const rankedPhones = rankPhones(allPhones);
    const mergedRawText = pages.map((page) => page.rawText).join('\n').slice(0, MERGED_TEXT_LIMIT);
    const title = pages[0]?.title || pages.find((page) => page.title)?.title || null;
    const description = pages[0]?.description || pages.find((page) => page.description)?.description || null;
    const ogTitle = pages[0]?.og_title || pages.find((page) => page.og_title)?.og_title || null;
    const ogDescription = pages[0]?.og_description || pages.find((page) => page.og_description)?.og_description || null;
    const companyOverview = pickOverview(allOverviews);
    const keyServices = uniqueLines(allServiceCandidates, 8);
    const keyMessages = uniqueLines(allMessageCandidates, 8);
    const evidenceSnippets = uniqueLines(allEvidenceCandidates, 8);
    const crawledUrls = pages.map((page) => page.url);

    return {
      emails: rankedEmails,
      phones: rankedPhones,
      description,
      title,
      og_title: ogTitle,
      og_description: ogDescription,
      raw_text: mergedRawText,
      pages_crawled: pages.length,
      crawled_urls: crawledUrls,
      contact_pages: Array.from(contactPages),
      company_overview: companyOverview,
      key_services: keyServices,
      key_messages: keyMessages,
      evidence_snippets: evidenceSnippets,
      success: true,
      error: firstFailure || undefined,
    };
  } catch (error) {
    if (error instanceof Error) {
      return emptyScrapedInfo(error.name === 'AbortError' ? 'Request timeout' : error.message);
    }
    return emptyScrapedInfo('Unknown error');
  }
}

/**
 * Generate a summary of the scraped information
 * @param info - Scraped information
 * @returns Human-readable summary
 */
export function generateSummary(info: ScrapedInfo): string {
  if (!info.success) {
    return `크롤링 실패: ${info.error}`;
  }

  const parts: string[] = [];

  if (info.title) {
    parts.push(`제목: ${info.title}`);
  }

  if (info.description || info.og_description) {
    const desc = info.og_description || info.description;
    parts.push(`설명: ${desc}`);
  }

  if (info.company_overview) {
    parts.push(`기업 소개: ${info.company_overview}`);
  }

  if (info.pages_crawled > 0) {
    parts.push(`크롤링 페이지 수: ${info.pages_crawled}`);
  }

  if (info.emails.length > 0) {
    parts.push(`이메일: ${info.emails.join(', ')}`);
  }

  if (info.phones.length > 0) {
    parts.push(`전화: ${info.phones.join(', ')}`);
  }

  if (info.key_services.length > 0) {
    parts.push(`주요 서비스: ${info.key_services.slice(0, 3).join(' / ')}`);
  }

  if (parts.length === 0) {
    parts.push('홈페이지 확인됨. 연락처 정보 미확인.');
  }

  return parts.join('\n');
}
