/**
 * Bulk Lead Delete API
 * Removes multiple leads from Redis
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { RedisKeys, ALL_STATUSES, type LeadState } from '@/lib/crm-types';

export async function POST(request: NextRequest) {
    try {
        const { leadIds } = await request.json();

        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return NextResponse.json({ error: 'Lead IDs are required' }, { status: 400 });
        }

        // Process each lead
        await Promise.all(
            leadIds.map(async (leadId) => {
                const state = await redis.get<LeadState>(RedisKeys.leadState(leadId));

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
                    // If state is missing, try removing from all possible status indices
                    for (const status of ALL_STATUSES) {
                        deleteOps.push(redis.zRem(RedisKeys.idxStatus(status), leadId));
                    }
                }

                await Promise.all(deleteOps);
            })
        );

        return NextResponse.json({ success: true, deletedCount: leadIds.length });
    } catch (error) {
        console.error('Error in bulk delete:', error);
        return NextResponse.json(
            { error: 'Failed to delete leads' },
            { status: 500 }
        );
    }
}
