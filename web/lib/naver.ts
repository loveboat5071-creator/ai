/**
 * Naver News API Integration for KOBACO Advertiser Discovery Bot
 * Fetches news articles by keywords
 */

import { stripHtml } from './crm-types';
import type { NormalizedArticle } from './rss-parser';

// ============================================================================
// Types
// ============================================================================

export interface NaverConfig {
  naverClientId: string;
  naverClientSecret: string;
  keywords: string[];
}

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

interface NaverNewsResponse {
  items: NaverNewsItem[];
}

// ============================================================================
// Constants
// ============================================================================

const NAVER_NEWS_API = 'https://openapi.naver.com/v1/search/news.json';
const MAX_KEYWORDS = 5;
const DISPLAY_PER_PAGE = 100;
const MAX_TOTAL_PER_KEYWORD = 1000;

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch news for a single keyword
 */
async function fetchNewsForKeyword(
  keyword: string,
  clientId: string,
  clientSecret: string,
  options?: { daysWindow?: number; maxItems?: number }
): Promise<NormalizedArticle[]> {
  const cutoffMs =
    options?.daysWindow && options.daysWindow > 0
      ? Date.now() - options.daysWindow * 24 * 60 * 60 * 1000
      : null;
  const maxItems = options?.maxItems ?? MAX_TOTAL_PER_KEYWORD;
  let start = 1;
  const collected: NormalizedArticle[] = [];

  while (start <= MAX_TOTAL_PER_KEYWORD && collected.length < maxItems) {
    const params = new URLSearchParams({
      query: keyword,
      display: DISPLAY_PER_PAGE.toString(),
      sort: 'date',
      start: start.toString(),
    });

    const url = `${NAVER_NEWS_API}?${params}`;

    try {
      const response = await fetch(url, {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      });

      if (!response.ok) {
        console.error(
          `Naver API error for keyword "${keyword}":`,
          response.status,
          response.statusText
        );
        break;
      }

      const data: NaverNewsResponse = await response.json();
      if (!data.items || data.items.length === 0) {
        break;
      }

      let oldestItemMs: number | null = null;

      const normalized = data.items.map((item) => {
        const link = item.originallink?.trim() || item.link?.trim() || '';
        const pubMs = Date.parse(item.pubDate);
        if (!Number.isNaN(pubMs)) {
          if (oldestItemMs === null || pubMs < oldestItemMs) {
            oldestItemMs = pubMs;
          }
        }
        return {
          title: stripHtml(item.title),
          link,
          contentSnippet: stripHtml(item.description),
          pubDate: item.pubDate,
          _source: 'NAVER',
          _keyword: keyword,
        };
      });

      const filtered = cutoffMs
        ? normalized.filter((item) => {
            const ts = Date.parse(item.pubDate);
            return !Number.isNaN(ts) && ts >= cutoffMs;
          })
        : normalized;

      collected.push(...filtered);

      if (cutoffMs && oldestItemMs !== null && oldestItemMs < cutoffMs) {
        break;
      }

      if (data.items.length < DISPLAY_PER_PAGE) {
        break;
      }

      start += DISPLAY_PER_PAGE;
    } catch (error) {
      console.error(`Failed to fetch Naver news for keyword "${keyword}":`, error);
      break;
    }
  }

  return collected.slice(0, maxItems);
}

/**
 * Fetch news for multiple keywords
 * Max 5 keywords as per spec
 */
export async function fetchNaverNews(
  config: NaverConfig,
  options?: { daysWindow?: number; maxItemsPerKeyword?: number }
): Promise<NormalizedArticle[]> {
  if (!config.naverClientId || !config.naverClientSecret) {
    console.warn('Naver API credentials not configured');
    return [];
  }

  if (!config.keywords || config.keywords.length === 0) {
    console.warn('No Naver keywords configured');
    return [];
  }

  // Take max 5 keywords
  const keywords = config.keywords.slice(0, MAX_KEYWORDS);

  const results = await Promise.allSettled(
    keywords.map((keyword) =>
      fetchNewsForKeyword(
        keyword,
        config.naverClientId,
        config.naverClientSecret,
        { daysWindow: options?.daysWindow, maxItems: options?.maxItemsPerKeyword }
      )
    )
  );

  const articles: NormalizedArticle[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
    }
  }

  return articles;
}

/**
 * Validate Naver API credentials
 */
export async function validateNaverCredentials(
  clientId: string,
  clientSecret: string
): Promise<boolean> {
  const params = new URLSearchParams({
    query: '테스트',
    display: '1',
  });

  const url = `${NAVER_NEWS_API}?${params}`;

  try {
    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}
