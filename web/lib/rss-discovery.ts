/**
 * RSS Feed Discovery Utility
 * Discovers RSS/Atom feeds from URLs (direct or via HTML link rel="alternate")
 */

import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

const FETCH_TIMEOUT = 7000; // 7 seconds

const parser = new Parser({
    timeout: FETCH_TIMEOUT,
    headers: {
        'User-Agent': 'KOBACO-Advertiser-Discovery-Bot/1.0',
    },
});

interface DiscoveryResult {
    feedUrl: string;
    title?: string;
}

/**
 * Discover RSS/Atom feed from a URL
 * 
 * 1. Try parsing as feed directly
 * 2. If fails, fetch HTML and find <link rel="alternate" ...>
 * 3. Parse discovered feed URL
 */
export async function discoverFeed(inputUrl: string): Promise<DiscoveryResult> {
    // Normalize and validate URL
    const url = inputUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error('URL must start with http:// or https://');
    }

    // Step 1: Try direct parse
    try {
        const feed = await parser.parseURL(url);
        return {
            feedUrl: url,
            title: feed.title || undefined,
        };
    } catch {
        // Direct parse failed, try HTML discovery
    }

    // Step 2: Fetch HTML and discover feed link
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    let html: string;
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'KOBACO-Advertiser-Discovery-Bot/1.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });
        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';
        html = await response.text();

        // Check if response is HTML
        const isHtml =
            contentType.includes('text/html') ||
            html.trim().toLowerCase().startsWith('<!doctype') ||
            html.trim().toLowerCase().startsWith('<html');

        if (!isHtml) {
            throw new Error('URL does not return HTML content');
        }
    } catch (error) {
        clearTimeout(timeoutId);
        if ((error as Error).name === 'AbortError') {
            throw new Error('Request timeout');
        }
        throw new Error(`Failed to fetch URL: ${(error as Error).message}`);
    }

    // Parse HTML and find feed links
    const $ = cheerio.load(html);
    const feedLinks: string[] = [];

    // Find RSS/Atom links
    $('link[rel="alternate"]').each((_, el) => {
        const type = $(el).attr('type') || '';
        const href = $(el).attr('href');

        if (
            href &&
            (type.includes('rss') ||
                type.includes('atom') ||
                type.includes('rdf') ||
                type === 'application/rss+xml' ||
                type === 'application/atom+xml')
        ) {
            // Resolve relative URL
            try {
                const resolvedUrl = new URL(href, url).toString();
                feedLinks.push(resolvedUrl);
            } catch {
                // Invalid URL, skip
            }
        }
    });

    if (feedLinks.length === 0) {
        throw new Error('No RSS/Atom feed discovered');
    }

    // Step 3: Try parsing discovered feeds
    for (const feedUrl of feedLinks) {
        try {
            const feed = await parser.parseURL(feedUrl);
            return {
                feedUrl,
                title: feed.title || undefined,
            };
        } catch {
            // Try next feed URL
            continue;
        }
    }

    throw new Error('No valid RSS/Atom feed found');
}
