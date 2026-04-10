import fs from 'fs';
import path from 'path';
import { redis } from '@/lib/redis';

export interface AdMinerRecord extends Record<string, unknown> {
  id: string;
  receivedAt: string;
  source: 'extension';
}

const REDIS_KEY = 'ad-miner:records';
const MAX_RECORDS = 2000;
const FILE_PATH = path.join(process.cwd(), 'content', 'ad-miner.json');

function parseRecord(raw: string): AdMinerRecord | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as AdMinerRecord;
  } catch {
    return null;
  }
}

function readFileRecords(): AdMinerRecord[] {
  try {
    if (!fs.existsSync(FILE_PATH)) return [];
    const raw = fs.readFileSync(FILE_PATH, 'utf-8').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean) as AdMinerRecord[];
  } catch {
    return [];
  }
}

function writeFileRecords(records: AdMinerRecord[]): void {
  try {
    fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify(records, null, 2));
  } catch {
    // Ignore read-only environments.
  }
}

function normalizeLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit)) return 100;
  return Math.max(1, Math.min(Math.floor(limit), MAX_RECORDS));
}

export async function appendAdMinerRecord(payload: Record<string, unknown>): Promise<AdMinerRecord> {
  const record: AdMinerRecord = {
    ...payload,
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    source: 'extension',
  };

  try {
    await redis.lPush(REDIS_KEY, JSON.stringify(record));
    await redis.lTrim(REDIS_KEY, 0, MAX_RECORDS - 1);
  } catch {
    const existing = readFileRecords();
    existing.unshift(record);
    writeFileRecords(existing.slice(0, MAX_RECORDS));
  }

  return record;
}

export async function listAdMinerRecords(limit = 100): Promise<AdMinerRecord[]> {
  const normalizedLimit = normalizeLimit(limit);

  try {
    const items = await redis.lRange(REDIS_KEY, 0, normalizedLimit - 1);
    return items
      .map(parseRecord)
      .filter((item): item is AdMinerRecord => item !== null);
  } catch {
    return readFileRecords().slice(0, normalizedLimit);
  }
}
