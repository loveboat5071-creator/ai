/**
 * Redis Index Cleanup API
 * Synchronizes indices with actual lead data
 */

import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { RedisKeys, ALL_STATUSES, type LeadCore } from '@/lib/crm-types';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const stats = {
            total_checked: 0,
            removed_from_all: 0,
            removed_from_status: 0,
            details: [] as string[]
        };

        // 1. Cleanup idxAll
        const allMemberIds = await redis.zrange(RedisKeys.idxAll(), 0, -1);
        stats.total_checked = allMemberIds.length;

        for (const leadId of allMemberIds) {
            const core = await redis.get<LeadCore>(RedisKeys.leadCore(leadId));
            if (!core) {
                // Lead data is missing, remove from all indices
                await redis.zRem(RedisKeys.idxAll(), leadId);
                stats.removed_from_all++;
                
                // Try to remove from all status indices just in case
                for (const status of ALL_STATUSES) {
                    await redis.zRem(RedisKeys.idxStatus(status), leadId);
                }
                stats.details.push(`Removed orphaned ID from indices: ${leadId}`);
            }
        }

        // 2. Double check all status indices
        for (const status of ALL_STATUSES) {
            const statusMemberIds = await redis.zrange(RedisKeys.idxStatus(status), 0, -1);
            for (const leadId of statusMemberIds) {
                const core = await redis.get<LeadCore>(RedisKeys.leadCore(leadId));
                if (!core) {
                    await redis.zRem(RedisKeys.idxStatus(status), leadId);
                    stats.removed_from_status++;
                    
                    // Also ensure it's removed from idxAll if it was missing there too
                    await redis.zRem(RedisKeys.idxAll(), leadId);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Index cleanup completed',
            stats
        });
    } catch (error: any) {
        console.error('Cleanup error:', error);
        return NextResponse.json(
            { error: 'Failed to perform cleanup', details: error.message },
            { status: 500 }
        );
    }
}
