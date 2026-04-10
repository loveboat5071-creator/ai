/**
 * RSS Feed Parser for KOBACO Advertiser Discovery Bot
 * Fetches latest news from Korean newswire sources
 */

import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { stripHtml } from './crm-types';

// ============================================================================
// Types
// ============================================================================

export interface NormalizedArticle {
  title: string;
  link: string;
  contentSnippet: string;
  pubDate: string;
  _source: string;
  _keyword?: string;
  _category?: string;
}

export interface RSSFeedConfig {
  category: string;
  url: string;
  title?: string;
  originalUrl?: string;
  enabled?: boolean;
}

// ============================================================================
// Default RSS Feed Sources (Fallback)
// ============================================================================

const DEFAULT_RSS: RSSFeedConfig[] = [
  { category: '신상품/신기술', url: 'https://www.newswire.co.kr/rss/industry/200' },
  { category: '소비재/쇼핑', url: 'https://www.newswire.co.kr/rss/industry/500' },
  { category: '생활/식음료', url: 'https://www.newswire.co.kr/rss/industry/504' },
  { category: '헬스케어', url: 'https://www.newswire.co.kr/rss/industry/900' },
];

// ============================================================================
// RSS Parser
// ============================================================================

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'KOBACO-Advertiser-Discovery-Bot/1.0',
  },
});

/**
 * Fetch articles from a single RSS feed
 */
async function fetchFeed(
  feedUrl: string,
  category: string,
  limit: number = 6
): Promise<NormalizedArticle[]> {
  try {
    const feed = await parser.parseURL(feedUrl);

    const items = limit > 0 ? feed.items.slice(0, limit) : feed.items;

    return items.map((item) => ({
      title: stripHtml(item.title || ''),
      link: item.link || '',
      contentSnippet: stripHtml(item.contentSnippet || item.content || ''),
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      _source: 'RSS',
      _keyword: category,
      _category: category,
    }));
  } catch (error) {
    console.error(`Failed to fetch RSS feed ${category} (${feedUrl}):`, error);
    return [];
  }
}

/**
 * Fetch articles from custom/configured RSS feeds
 */
export async function fetchCustomFeeds(
  feeds: RSSFeedConfig[],
  limitPerFeed: number = 6
): Promise<NormalizedArticle[]> {
  if (!feeds || feeds.length === 0) {
    return fetchDefaultFeeds(limitPerFeed);
  }

  const results = await Promise.allSettled(
    feeds.map((feed) => fetchFeed(feed.url, feed.category, limitPerFeed))
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
 * Fetch articles from default RSS feeds (fallback)
 */
export async function fetchDefaultFeeds(
  limitPerFeed: number = 6
): Promise<NormalizedArticle[]> {
  const results = await Promise.allSettled(
    DEFAULT_RSS.map((feed) => fetchFeed(feed.url, feed.category, limitPerFeed))
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
 * Fetch articles from all RSS feeds (legacy - uses default feeds)
 */
export async function fetchAllRSSFeeds(
  limitPerFeed: number = 6
): Promise<NormalizedArticle[]> {
  return fetchDefaultFeeds(limitPerFeed);
}

/**
 * Get default RSS feed configs
 */
export function getDefaultRSSFeeds(): RSSFeedConfig[] {
  return [...DEFAULT_RSS];
}

/**
 * Fetch full content of an article
 */
export async function fetchFullContent(url: string): Promise<string> {
  try {
    const { data } = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    const $ = cheerio.load(data);

    // Remove scripts, styles, and common navigation/footer elements
    $('script, style, nav, footer, iframe, header').remove();

    // Domain-specific selectors
    if (url.includes('newswire.co.kr')) {
      // Newswire specific: main article body + contact info
      const body = $('#news-body').text().trim();
      const contact = $('.contact-area').text().trim() || $('#news-contact').text().trim();

      // If specific selectors fail, fallback to a broader one
      if (body) return `${body}\n\n${contact}`.trim();
    }

    // Fallback: try common article body selectors
    const bodyText = $('article, .article-body, .post-content, main, .content').text().trim();

    // If all else fails, use the body but it might be noisy
    if (bodyText && bodyText.length > 200) {
      return bodyText;
    }

    // Hard fallback: just take the body text but cleaned up
    return $('body').text().replace(/\s\s+/g, ' ').trim().slice(0, 5000);
  } catch (error) {
    console.error(`Failed to fetch full content from ${url}:`, error);
    return '';
  }
}
