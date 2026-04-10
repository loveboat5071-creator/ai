import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

const CRON_QUEUE_KEY = 'scan:cron:queue';

export async function GET() {
  try {
    const queueLength = await redis.llen(CRON_QUEUE_KEY);
    return NextResponse.json({ queueLength });
  } catch (error) {
    console.error('Queue length error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue length' },
      { status: 500 }
    );
  }
}
