import { createClient } from 'redis';
import fs from 'fs';
import path from 'path';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const POLICY_DIR = path.join(process.cwd(), 'policy');

// Priority: wsmedia_REDIS_URL -> wsmedia_KV_URL -> REDIS_URL -> KV_URL
const REDIS_URL =
    process.env.wsmedia_REDIS_URL ||
    process.env.wsmedia_KV_URL ||
    process.env.REDIS_URL ||
    process.env.KV_URL;

let client: ReturnType<typeof createClient> | null = null;

async function getClient() {
    // If client exists and is ready, reuse it
    if (client && client.isOpen) return client;

    // If no URL is provided, we can't use Redis
    if (!REDIS_URL) return null;

    try {
        // Create a new client instance
        // Reusing the global variable ensures we don't create too many connections
        if (!client) {
            client = createClient({
                url: REDIS_URL
            });
            client.on('error', (err) => console.error('Redis Client Error', err));
        }

        // Connect if not already connected
        if (!client.isOpen) {
            await client.connect();
            console.log('✅ Redis connected');
        }

        return client;
    } catch (e) {
        console.error('❌ Failed to connect Redis:', e);
        return null; // Fallback to FS
    }
}

type StoreType = 'content' | 'policy';

/**
 * Get JSON data
 */
export async function getJSON(type: StoreType, id: string): Promise<any> {
    const key = `${type}:${id}`;
    const redis = await getClient(); // Get connected client

    // 1. Try Redis
    if (redis) {
        try {
            const data = await redis.get(key);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error(`[Redis] Get Error for ${key}:`, e);
        }
    }

    // 2. Fallback to File System
    try {
        let filePath = '';
        if (type === 'policy') {
            filePath = path.join(POLICY_DIR, `${id}.json`);
        } else if (id === 'home') {
            filePath = path.join(CONTENT_DIR, 'home.json');
        } else {
            filePath = path.join(CONTENT_DIR, 'sections', `${id}.json`);
        }

        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
    } catch (e) {
        // Ignore
    }

    return null;
}

/**
 * Save JSON data
 */
export async function setJSON(type: StoreType, id: string, data: any): Promise<void> {
    const key = `${type}:${id}`;
    const jsonString = JSON.stringify(data);
    const redis = await getClient();

    // 1. Write to Redis
    if (redis) {
        try {
            await redis.set(key, jsonString);
            console.log(`[Redis] Updated ${key}`);
        } catch (e) {
            console.error(`[Redis] Set Error for ${key}:`, e);
        }
    }

    // 2. Write to FS (Local Sync)
    try {
        let filePath = '';
        if (type === 'policy') {
            filePath = path.join(POLICY_DIR, `${id}.json`);
        } else if (id === 'home') {
            filePath = path.join(CONTENT_DIR, 'home.json');
        } else {
            const sectionsDir = path.join(CONTENT_DIR, 'sections');
            if (!fs.existsSync(sectionsDir)) fs.mkdirSync(sectionsDir, { recursive: true });
            filePath = path.join(sectionsDir, `${id}.json`);
        }

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e: any) {
        if (e.code !== 'EROFS' && e.code !== 'EACCES') {
            // console.error(`[FS] Write Error:`, e);
        }
    }
}
