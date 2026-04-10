import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { redis } from '@/lib/redis';
import {
  RedisKeys,
  type LeadState,
  type OutreachLog,
  type OutreachStatus,
  type OutreachType,
} from '@/lib/crm-types';

export const dynamic = 'force-dynamic';

const MAX_OUTREACH_LOGS = 200;

interface OutreachRequest {
  type?: OutreachType;
  status?: OutreachStatus;
  subject?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const body: OutreachRequest = await request.json();

    const type = body.type || 'email';
    const status = body.status || 'sent';
    const subject = body.subject?.trim();

    if (!['email', 'phone'].includes(type)) {
      return NextResponse.json({ error: 'Invalid outreach type' }, { status: 400 });
    }

    if (!['sent', 'replied', 'bounced'].includes(status)) {
      return NextResponse.json({ error: 'Invalid outreach status' }, { status: 400 });
    }

    const stateKey = RedisKeys.leadState(leadId);
    const existingState = await redis.get<LeadState>(stateKey);

    if (!existingState) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const now = Date.now();

    const log: OutreachLog = {
      id: randomUUID(),
      lead_id: leadId,
      type,
      status,
      subject,
      sent_at: now,
    };

    await redis.lPush(RedisKeys.leadOutreach(leadId), JSON.stringify(log));
    await redis.lTrim(RedisKeys.leadOutreach(leadId), 0, MAX_OUTREACH_LOGS - 1);

    const updatedState: LeadState = {
      ...existingState,
      status: existingState.status === 'NEW' ? 'CONTACTED' : existingState.status,
      status_changed_at: existingState.status === 'NEW' ? now : existingState.status_changed_at,
      last_contacted_at: now,
    };

    await redis.set(stateKey, updatedState);

    await redis.zadd(RedisKeys.idxAll(), { score: now, member: leadId });

    if (existingState.status !== updatedState.status) {
      await redis.zRem(RedisKeys.idxStatus(existingState.status), leadId);
    }

    await redis.zadd(RedisKeys.idxStatus(updatedState.status), {
      score: now,
      member: leadId,
    });

    return NextResponse.json({
      success: true,
      log,
      state: updatedState,
    });
  } catch (error) {
    console.error('Error creating outreach log:', error);
    return NextResponse.json(
      { error: 'Failed to create outreach log' },
      { status: 500 }
    );
  }
}
