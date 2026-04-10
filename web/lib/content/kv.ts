import { createClient } from 'redis';
import fs from 'fs';
import path from 'path';
import { SECTION_SCHEMAS, SectionType } from '@/lib/sections/schemas';
import { getJSON as getFallbackJSON, setJSON as setFallbackJSON } from '@/lib/kv-store'; // Use fallback logic from previous implementation for initial seed

// Priority: wsmedia_REDIS_URL -> wsmedia_KV_URL -> REDIS_URL -> KV_URL
const REDIS_URL =
    process.env.wsmedia_REDIS_URL ||
    process.env.wsmedia_KV_URL ||
    process.env.REDIS_URL ||
    process.env.KV_URL;

let client: ReturnType<typeof createClient> | null = null;

async function getClient() {
    if (client && client.isOpen) return client;
    if (!REDIS_URL) return null;

    try {
        if (!client) {
            client = createClient({ url: REDIS_URL });
            client.on('error', (err) => console.error('Redis Client Error', err));
        }
        if (!client.isOpen) await client.connect();
        return client;
    } catch (e) {
        console.error('❌ Failed to connect Redis:', e);
        return null;
    }
}

// Key Contract
const KEYS = {
    HOME: 'landing:home',
    SECTION: (id: string) => `landing:section:${id}`,
    ETAG: 'landing:etag',
    STATS: {
        SEARCH_COUNT_DAY: (date: string) => `stats:search:count:day:${date}`,
        SEARCH_TERMS_DAY: (date: string) => `stats:search:terms:day:${date}`,
        SEARCH_TERMS_MONTH: (month: string) => `stats:search:terms:month:${month}`,
        SEARCH_RECENT: 'stats:search:recent',
        CTA_COUNT_DAY: (id: string, date: string) => `stats:cta:${id}:count:day:${date}`,
        CTA_COUNT_MONTH: (id: string, month: string) => `stats:cta:${id}:count:month:${month}`,
        ADMIN_SAVE_DAY: (date: string) => `stats:admin:save:day:${date}`,
        ADMIN_UPLOAD_DAY: (date: string) => `stats:admin:image_upload:day:${date}`,
    },
    CONFIG: 'system:config:notifications'
};

// ... existing code ...

// --- System Config Service ---

export async function getSystemConfig() {
    const redis = await getClient();
    if (redis) {
        try {
            const data = await redis.get(KEYS.CONFIG);
            if (data) return JSON.parse(data);
        } catch (e) { console.error('KV Config Get Error', e); }
    }
    return {};
}

export async function saveSystemConfig(config: any) {
    const redis = await getClient();
    if (redis) {
        await redis.set(KEYS.CONFIG, JSON.stringify(config));
    }
}


// --- Helper: ETag ---
async function bumpEtag(redis: any) {
    await redis.set(KEYS.ETAG, `v${Date.now()}`);
}

// --- Helper: Date Strings (KST) ---
function getKSTDateStrings() {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return {
        date: `${yyyy}-${mm}-${dd}`,
        month: `${yyyy}-${mm}`
    };
}

// --- Content Service ---

export async function getHome() {
    const redis = await getClient();
    if (redis) {
        try {
            const data = await redis.get(KEYS.HOME);
            if (data) return JSON.parse(data);
        } catch (e) { console.error('KV Home Get Error', e); }
    }
    // Fallback
    return await getFallbackJSON('content', 'home');
}

export async function getSection(id: string) {
    const redis = await getClient();
    if (redis) {
        try {
            const data = await redis.get(KEYS.SECTION(id));
            if (data) return JSON.parse(data);
        } catch (e) { console.error(`KV Section(${id}) Get Error`, e); }
    }
    // Fallback
    return await getFallbackJSON('content', id);
}

export async function saveHome(homeData: any) {
    const redis = await getClient();

    // Basic Validation
    if (!homeData.sections || !Array.isArray(homeData.sections)) {
        throw new Error("Invalid Home Data: sections array required");
    }

    const payload = {
        version: 1,
        updatedAt: new Date().toISOString(),
        sections: homeData.sections
    };

    if (redis) {
        const multi = redis.multi();
        multi.set(KEYS.HOME, JSON.stringify(payload));

        // Bump Etag
        multi.set(KEYS.ETAG, `v${Date.now()}`);

        // Stats: Admin Save
        const { date } = getKSTDateStrings();
        multi.incr(KEYS.STATS.ADMIN_SAVE_DAY(date));

        await multi.exec();
    }

    // Also Save to File System (Persist for Git)
    await setFallbackJSON('content', 'home', payload);
}

export async function saveSection(id: string, type: string, data: any) {
    const redis = await getClient();

    // 1. Validate Schema
    const schema = SECTION_SCHEMAS[type];
    if (!schema) throw new Error(`Unknown Section Type: ${type}`);

    const parseResult = schema.safeParse(data);
    if (!parseResult.success) {
        throw new Error(`Validation Failed: ${parseResult.error.message}`);
    }
    const safeData = parseResult.data; // Stripped of unknown fields

    // 2. Save
    if (redis) {
        const multi = redis.multi();
        multi.set(KEYS.SECTION(id), JSON.stringify(safeData));
        multi.set(KEYS.ETAG, `v${Date.now()}`); // Bump Etag

        // Stats: Admin Save
        const { date } = getKSTDateStrings();
        multi.incr(KEYS.STATS.ADMIN_SAVE_DAY(date));

        await multi.exec();
    }

    // Also Save to File System (Persist for Git)
    await setFallbackJSON('content', id, safeData);
}

export async function deleteSection(id: string) {
    const redis = await getClient();
    if (redis) {
        const multi = redis.multi();
        multi.del(KEYS.SECTION(id));
        multi.set(KEYS.ETAG, `v${Date.now()}`); // Bump Etag
        await multi.exec();
    }

    // Also Delete from File System
    try {
        const filePath = path.join(process.cwd(), 'content', 'sections', `${id}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) {
        console.error(`Failed to delete section file: ${id}`, e);
    }
}

// --- Stats Service ---

export async function trackSearch(term: string) {
    const redis = await getClient();
    if (!redis || !term.trim()) return;

    const { date, month } = getKSTDateStrings();
    const cleanTerm = term.trim().substring(0, 50); // Limit length

    const multi = redis.multi();
    multi.incr(KEYS.STATS.SEARCH_COUNT_DAY(date));
    multi.zincrby(KEYS.STATS.SEARCH_TERMS_DAY(date), 1, cleanTerm);
    multi.zincrby(KEYS.STATS.SEARCH_TERMS_MONTH(month), 1, cleanTerm);

    // Recent Search Terms (List, capped at 200)
    multi.lpush(KEYS.STATS.SEARCH_RECENT, cleanTerm);
    multi.ltrim(KEYS.STATS.SEARCH_RECENT, 0, 199);

    await multi.exec();
}

export async function trackCtaClick(ctaId: string) {
    const redis = await getClient();
    if (!redis || !ctaId) return;

    const { date, month } = getKSTDateStrings();
    const multi = redis.multi();
    multi.incr(KEYS.STATS.CTA_COUNT_DAY(ctaId, date));
    multi.incr(KEYS.STATS.CTA_COUNT_MONTH(ctaId, month));
    // Global CTA Counter
    multi.incr(`stats:cta:global:count:day:${date}`);
    await multi.exec();
}

export async function trackImageUpload() {
    const redis = await getClient();
    if (!redis) return;
    const { date } = getKSTDateStrings();
    await redis.incr(KEYS.STATS.ADMIN_UPLOAD_DAY(date));
}

export async function getStatsDashboard() {
    const redis = await getClient();
    if (!redis) return {};

    const { date, month } = getKSTDateStrings();

    // Fetch parallel
    const [
        todaySearchCount,
        todayTopTermsRaw,
        monthTopTermsRaw,
        recentTerms,
        todaySaves,
        todayUploads,
        todayCtaCount
    ] = await Promise.all([
        redis.get(KEYS.STATS.SEARCH_COUNT_DAY(date)),
        redis.zRangeWithScores(KEYS.STATS.SEARCH_TERMS_DAY(date), 0, 9, { REV: true }),
        redis.zRangeWithScores(KEYS.STATS.SEARCH_TERMS_MONTH(month), 0, 9, { REV: true }),
        redis.lRange(KEYS.STATS.SEARCH_RECENT, 0, 19), // Latest 20
        redis.get(KEYS.STATS.ADMIN_SAVE_DAY(date)),
        redis.get(KEYS.STATS.ADMIN_UPLOAD_DAY(date)),
        redis.get(`stats:cta:global:count:day:${date}`)
    ]);

    const normalizeZRangeWithScores = (input: any): string[] => {
        if (!Array.isArray(input)) return [];
        // node-redis v4 returns objects when WITHSCORES is true
        if (input.length > 0 && typeof input[0] === 'object' && input[0] !== null && 'value' in input[0]) {
            return (input as Array<{ value: string; score: number }>).flatMap(({ value, score }) => [value, String(score)]);
        }
        return input as string[];
    };

    const todayTopTerms = normalizeZRangeWithScores(todayTopTermsRaw);
    const monthTopTerms = normalizeZRangeWithScores(monthTopTermsRaw);

    return {
        date, month,
        todaySearchCount: parseInt(todaySearchCount || '0'),
        todaySaves: parseInt(todaySaves || '0'),
        todayUploads: parseInt(todayUploads || '0'),
        todayTopTerms, // ['term', 'score', 'term', 'score']
        monthTopTerms,
        recentTerms
    };
}
