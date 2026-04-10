/**
 * Test Feed Discovery Endpoint
 * POST /api/sales/config/test-feed
 */

import { NextRequest, NextResponse } from 'next/server';
import { discoverFeed } from '@/lib/rss-discovery';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { success: false, error: 'URL is required' },
                { status: 400 }
            );
        }

        const result = await discoverFeed(url.trim());

        return NextResponse.json({
            success: true,
            feedUrl: result.feedUrl,
            title: result.title || '(untitled)',
        });
    } catch (error) {
        console.error('Feed discovery error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
