import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { get, list, put } from '@vercel/blob';

export type ActivityAction = 'search' | 'search-district' | 'pdf' | 'excel' | 'telegram';

export interface ActivityLogEntry {
  timestamp: string;
  action: ActivityAction;
  address: string;
  radii: number[];
  resultCount?: number;
  advertiserName?: string;
  campaignName?: string;
  ip?: string;
}

interface ActivityLogInput {
  action: ActivityAction;
  address: string;
  radii: number[];
  resultCount?: number;
  advertiserName?: string;
  campaignName?: string;
  ip?: string;
}

type ActivityLogStorage = 'blob' | 'local' | 'disabled';

const LOG_BLOB_PREFIX = 'activity-logs/';
const LOCAL_LOG_DIR = join(process.cwd(), '.data', 'activity-logs');
const LOG_BLOB_ACCESS = 'private';

export interface ActivityLogStatus {
  storage: ActivityLogStorage;
  enabled: boolean;
  fileCount: number;
  totalEntries: number;
  latestTimestamp?: string;
  latestPath?: string;
  message?: string;
}

export async function appendActivityLog(entry: ActivityLogInput): Promise<void> {
  const storage = getActivityLogStorage();
  if (storage === 'disabled') {
    return;
  }

  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const record: ActivityLogEntry = {
    timestamp: now.toISOString(),
    action: entry.action,
    address: entry.address,
    radii: entry.radii,
    resultCount: entry.resultCount,
    advertiserName: entry.advertiserName,
    campaignName: entry.campaignName,
    ip: entry.ip || '',
  };

  if (storage === 'blob') {
    const blobPath = getBlobPath(dateKey);
    const existing = await readBlobLogFile(blobPath);
    existing.push(record);
    await put(blobPath, JSON.stringify(existing), {
      access: 'private',
      addRandomSuffix: false,
      contentType: 'application/json',
      allowOverwrite: true,
    });
    return;
  }

  const filePath = getLocalLogPath(dateKey);
  const existing = await readLocalLogFile(filePath);
  existing.push(record);
  await mkdir(LOCAL_LOG_DIR, { recursive: true });
  await writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');
}

export async function readActivityLogs(limitDays = 30): Promise<{
  enabled: boolean;
  message?: string;
  logs: ActivityLogEntry[];
}> {
  const storage = getActivityLogStorage();
  if (storage === 'disabled') {
    return {
      enabled: false,
      message: '활동 로그 저장이 비활성화되어 있습니다.',
      logs: [],
    };
  }

  if (storage === 'blob') {
    const blobs = await list({ prefix: LOG_BLOB_PREFIX });
    const sorted = blobs.blobs
      .sort((a, b) => b.pathname.localeCompare(a.pathname))
      .slice(0, limitDays);

    const files = await Promise.all(
      sorted.map(async (blob) => {
        const logs = await readBlobLogFile(blob.pathname);
        return logs;
      })
    );

    return {
      enabled: true,
      logs: files.flat().sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    };
  }

  try {
    const files = await readdir(LOCAL_LOG_DIR);
    const sorted = files
      .filter((fileName) => fileName.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, limitDays);

    const logs = await Promise.all(
      sorted.map(async (fileName) => readLocalLogFile(join(LOCAL_LOG_DIR, fileName)))
    );

    return {
      enabled: true,
      logs: logs.flat().sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    };
  } catch {
    return { enabled: true, logs: [] };
  }
}

export async function getActivityLogStatus(limitDays = 30): Promise<ActivityLogStatus> {
  const storage = getActivityLogStorage();
  if (storage === 'disabled') {
    return {
      storage,
      enabled: false,
      fileCount: 0,
      totalEntries: 0,
      message: '활동 로그 저장이 비활성화되어 있습니다.',
    };
  }

  if (storage === 'blob') {
    try {
      const blobs = await list({ prefix: LOG_BLOB_PREFIX });
      const sorted = blobs.blobs
        .sort((a, b) => b.pathname.localeCompare(a.pathname))
        .slice(0, limitDays);
      const logs = await Promise.all(sorted.map((blob) => readBlobLogFile(blob.pathname)));
      const flattened = logs.flat().sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      return {
        storage,
        enabled: true,
        fileCount: sorted.length,
        totalEntries: flattened.length,
        latestTimestamp: flattened[0]?.timestamp,
        latestPath: sorted[0]?.pathname,
      };
    } catch (error) {
      return {
        storage,
        enabled: true,
        fileCount: 0,
        totalEntries: 0,
        message: String(error),
      };
    }
  }

  try {
    const files = await readdir(LOCAL_LOG_DIR);
    const sorted = files
      .filter((fileName) => fileName.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, limitDays);
    const logs = await Promise.all(sorted.map((fileName) => readLocalLogFile(join(LOCAL_LOG_DIR, fileName))));
    const flattened = logs.flat().sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return {
      storage,
      enabled: true,
      fileCount: sorted.length,
      totalEntries: flattened.length,
      latestTimestamp: flattened[0]?.timestamp,
      latestPath: sorted[0] ? join(LOCAL_LOG_DIR, sorted[0]) : undefined,
    };
  } catch (error) {
    return {
      storage,
      enabled: true,
      fileCount: 0,
      totalEntries: 0,
      message: String(error),
    };
  }
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || '';
  }
  return headers.get('x-real-ip') || '';
}

function getActivityLogStorage(): ActivityLogStorage {
  const configured = process.env.ACTIVITY_LOG_STORAGE?.trim().toLowerCase();
  if (configured === 'blob' || configured === 'local' || configured === 'disabled') {
    return configured;
  }

  return process.env.NODE_ENV === 'production' ? 'disabled' : 'local';
}

function getBlobPath(dateKey: string): string {
  return `${LOG_BLOB_PREFIX}${dateKey}.json`;
}

function getLocalLogPath(dateKey: string): string {
  return join(LOCAL_LOG_DIR, `${dateKey}.json`);
}

async function readBlobLogFile(blobPath: string): Promise<ActivityLogEntry[]> {
  const blob = await get(blobPath, {
    access: LOG_BLOB_ACCESS,
    useCache: false,
  });
  if (!blob || blob.statusCode !== 200) {
    return [];
  }

  try {
    const data = (await new Response(blob.stream).json()) as ActivityLogEntry[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function readLocalLogFile(filePath: string): Promise<ActivityLogEntry[]> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as ActivityLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
