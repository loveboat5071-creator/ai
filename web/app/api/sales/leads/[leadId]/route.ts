/**
 * Lead Delete API
 * Removes all trace of a lead from Redis
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { RedisKeys, LeadStatus, ALL_STATUSES, type LeadState } from '@/lib/crm-types';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ leadId: string }> }
) {
    try {
        const { leadId } = await params;

        if (!leadId) {
            return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
        }

        // Get current state to know which status index to remove from
        const state = await redis.get<LeadState>(RedisKeys.leadState(leadId));

        // Cleanup keys
        const deleteOps: Promise<any>[] = [
            redis.del(RedisKeys.leadCore(leadId)),
            redis.del(RedisKeys.leadState(leadId)),
            redis.del(RedisKeys.leadNotes(leadId)),
            redis.del(RedisKeys.leadOutreach(leadId)),
            redis.zRem(RedisKeys.idxAll(), leadId),
        ];

        if (state) {
            deleteOps.push(redis.zRem(RedisKeys.idxStatus(state.status), leadId));
        } else {
            // If state is missing, try removing from all possible status indices to be safe
            for (const status of ALL_STATUSES) {
                deleteOps.push(redis.zRem(RedisKeys.idxStatus(status), leadId));
            }
        }

        await Promise.all(deleteOps);

        return NextResponse.json({ success: true, leadId });
    } catch (error) {
        console.error('Error deleting lead:', error);
        return NextResponse.json(
            { error: 'Failed to delete lead' },
            { status: 500 }
        );
    }
}
