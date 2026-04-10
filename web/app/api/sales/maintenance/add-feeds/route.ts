
import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

const REDIS_KEY = 'config:sales:settings';

const newFeeds = [
    { category: '모바일/게임', title: '게임', url: 'https://api.newswire.co.kr/rss/industry/621' },
    { category: '모바일/게임', title: '모바일 앱', url: 'https://api.newswire.co.kr/rss/industry/614' },
    { category: '식음료', title: '식품·음료', url: 'https://api.newswire.co.kr/rss/industry/916' },
    { category: '화장품/뷰티', title: '화장품', url: 'https://api.newswire.co.kr/rss/industry/904' },
    { category: '패션', title: '의류·잡화', url: 'https://api.newswire.co.kr/rss/industry/903' },
    { category: '건강/헬스케어', title: '건강기능식품', url: 'https://api.newswire.co.kr/rss/industry/1004' },
    { category: '건강/헬스케어', title: '제약', url: 'https://api.newswire.co.kr/rss/industry/1001' },
    { category: '마케팅/광고 집행 시그널', title: '광고·마케팅', url: 'https://api.newswire.co.kr/rss/industry/112' }
];

export async function GET() {
    try {
        const config: any = await redis.get(REDIS_KEY) || { rssFeeds: [] };
        if (!config.rssFeeds) config.rssFeeds = [];

        const existingUrls = new Set(config.rssFeeds.map((f: any) => f.url));
        let addedCount = 0;
        const addedFeeds: string[] = [];

        for (const feed of newFeeds) {
            if (!existingUrls.has(feed.url)) {
                config.rssFeeds.push({
                    ...feed,
                    originalUrl: feed.url,
                    enabled: true
                });
                addedCount++;
                addedFeeds.push(feed.title);
            }
        }

        if (addedCount > 0) {
            await redis.set(REDIS_KEY, config);
            return NextResponse.json({
                success: true,
                message: `${addedCount} new feeds added.`,
                added: addedFeeds
            });
        } else {
            return NextResponse.json({
                success: true,
                message: `No new feeds were added. They might already exist.`
            });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
