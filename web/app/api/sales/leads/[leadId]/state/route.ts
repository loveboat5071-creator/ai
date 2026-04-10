/**
 * Lead State Update API
 * Update lead status and metadata
 * - Automatically blocks companies for 7 days when marked as EXCLUDED
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import {
  RedisKeys,
  isValidStatus,
  type LeadState,
  type LeadStatusType,
  type LeadCore,
} from '@/lib/crm-types';

export const dynamic = 'force-dynamic';

const BLOCKED_COMPANIES_KEY = 'scan:blocked:companies'; // Same as cron route
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

interface UpdateStateRequest {
  status?: LeadStatusType;
  tags?: string[];
  next_action?: string;
  assigned_to?: string;
  last_contacted_at?: number;
}

/**
 * PATCH /api/sales/leads/[leadId]/state
 * Update lead state and move between status indices
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const body: UpdateStateRequest = await request.json();

    // Fetch existing state
    const stateKey = RedisKeys.leadState(leadId);
    const existingState = await redis.get<LeadState>(stateKey);

    if (!existingState) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    const oldStatus = existingState.status;
    const newStatus = body.status || oldStatus;

    // Validate new status
    if (body.status && !isValidStatus(body.status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Build updated state
    const updatedState: LeadState = {
      ...existingState,
      status: newStatus,
      status_changed_at:
        newStatus !== oldStatus ? Date.now() : existingState.status_changed_at,
      tags: body.tags !== undefined ? body.tags : existingState.tags,
      next_action:
        body.next_action !== undefined
          ? body.next_action
          : existingState.next_action,
      assigned_to:
        body.assigned_to !== undefined
          ? body.assigned_to
          : existingState.assigned_to,
      last_contacted_at:
        body.last_contacted_at !== undefined
          ? body.last_contacted_at
          : existingState.last_contacted_at,
    };

    // Update operations
    const timestamp = Date.now();

    // Save updated state
    await redis.set(stateKey, updatedState);

    // Update idxAll
    await redis.zadd(RedisKeys.idxAll(), { score: timestamp, member: leadId });

    // If status changed, move between status indices
    if (newStatus !== oldStatus) {
      // Remove from old status index
      await redis.zRem(RedisKeys.idxStatus(oldStatus), leadId);

      // Add to new status index
      await redis.zadd(RedisKeys.idxStatus(newStatus), {
        score: timestamp,
        member: leadId,
      });

      // 🔥 NEW: If marked as EXCLUDED, block the company for 7 days
      if (newStatus === 'EXCLUDED') {
        const leadCore = await redis.get<LeadCore>(RedisKeys.leadCore(leadId));
        const companyName = leadCore?.ai_analysis?.company_name;

        if (companyName && companyName.trim()) {
          const expireAt = Date.now() + SEVEN_DAYS_MS;

          // Add to blocked companies (Sorted Set with expiration score)
          await redis.zadd(BLOCKED_COMPANIES_KEY, {
            score: expireAt,
            member: companyName,
          });

          console.log(`Blocked company "${companyName}" for 7 days (until ${new Date(expireAt).toISOString()})`);
        }
      }
    } else {
      // Just refresh timestamp in current status index
      await redis.zadd(RedisKeys.idxStatus(newStatus), {
        score: timestamp,
        member: leadId,
      });
    }

    return NextResponse.json({
      success: true,
      state: updatedState,
    });
  } catch (error) {
    console.error('Error updating lead state:', error);
    return NextResponse.json(
      { error: 'Failed to update state' },
      { status: 500 }
    );
  }
}
