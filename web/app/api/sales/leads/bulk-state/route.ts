/**
 * Bulk Lead State Update API
 * Updates lead status for multiple leads
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { RedisKeys, isValidStatus, type LeadState, type LeadStatusType } from '@/lib/crm-types';

export async function POST(request: NextRequest) {
  try {
    const { leadIds, status } = await request.json();

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'Lead IDs are required' }, { status: 400 });
    }

    if (!status || !isValidStatus(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const states = await Promise.all(
      leadIds.map((leadId) => redis.get<LeadState>(RedisKeys.leadState(leadId)))
    );

    const timestamp = Date.now();
    let updatedCount = 0;

    await Promise.all(
      leadIds.map(async (leadId, index) => {
        const existingState = states[index];
        if (!existingState) return;

        const oldStatus = existingState.status;
        const newStatus = status as LeadStatusType;

        const updatedState: LeadState = {
          ...existingState,
          status: newStatus,
          status_changed_at: newStatus !== oldStatus ? timestamp : existingState.status_changed_at,
        };

        await redis.set(RedisKeys.leadState(leadId), updatedState);
        await redis.zadd(RedisKeys.idxAll(), { score: timestamp, member: leadId });

        if (newStatus !== oldStatus) {
          await redis.zRem(RedisKeys.idxStatus(oldStatus), leadId);
          await redis.zadd(RedisKeys.idxStatus(newStatus), { score: timestamp, member: leadId });
        } else {
          await redis.zadd(RedisKeys.idxStatus(newStatus), { score: timestamp, member: leadId });
        }

        updatedCount += 1;
      })
    );

    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error('Error in bulk state update:', error);
    return NextResponse.json(
      { error: 'Failed to update lead states' },
      { status: 500 }
    );
  }
}
