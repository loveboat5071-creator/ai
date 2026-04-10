/**
 * Sales Leads Pipeline API
 * List leads by status with CRM data
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import {
  RedisKeys,
  isValidStatus,
  ALL_STATUSES,
  type LeadCore,
  type LeadState,
  type Lead,
  type LeadStatusType,
  type OutreachLog,
} from '@/lib/crm-types';

export const dynamic = 'force-dynamic';

interface LeadsResponse {
  success: boolean;
  leads: Lead[];
  status: string;
  total: number;
  limit: number;
  counts: Record<string, number>;
}

interface SalesConfig {
  excludedCompanies?: string[];
  excludedCompaniesTemporary?: Array<{ name: string; expiresAt: number }>;
}

function normalizeCompanyKey(name: string): string {
  return name.trim().toLowerCase();
}

function buildExcludedCompanySet(config?: SalesConfig | null): Set<string> {
  const keys = new Set<string>();

  for (const company of config?.excludedCompanies || []) {
    const key = normalizeCompanyKey(company);
    if (key) keys.add(key);
  }

  const now = Date.now();
  for (const item of config?.excludedCompaniesTemporary || []) {
    if (!item || item.expiresAt <= now) continue;
    const key = normalizeCompanyKey(item.name || '');
    if (key) keys.add(key);
  }

  return keys;
}

/**
 * GET /api/sales/leads?status=ALL&limit=50
 * Returns leads with state and notes count
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || 'ALL';
    const sortBy = searchParams.get('sortBy') || 'latest';
    const requestedLimit = parseInt(searchParams.get('limit') || '50');
    const limit = Math.min(requestedLimit, 200);

    // If sorting by score, we fetch more to find high-score samples
    const fetchLimit = sortBy === 'score' ? Math.max(limit, 100) : limit;
    const sourceFilter = searchParams.get('source');
    const mediaTypeFilterRaw = (searchParams.get('mediaType') || 'ALL').toUpperCase();
    const mediaTypeFilter =
      mediaTypeFilterRaw === 'FOCUS_MEDIA'
        ? mediaTypeFilterRaw
        : 'ALL';

    // Get lead IDs from index
    let leadIds: string[] = [];

    if (statusParam === 'ALL') {
      const members = await redis.zrange(RedisKeys.idxAll(), 0, fetchLimit - 1, {
        rev: true,
      });
      leadIds = members as string[];
    } else if (isValidStatus(statusParam)) {
      const members = await redis.zrange(
        RedisKeys.idxStatus(statusParam as LeadStatusType),
        0,
        fetchLimit - 1,
        { rev: true }
      );
      leadIds = members as string[];
    } else {
      return NextResponse.json(
        { error: 'Invalid status parameter' },
        { status: 400 }
      );
    }

    // Fetch LeadCore and LeadState in pipeline
    const leads: Lead[] = [];

    for (const leadId of leadIds) {
      const [core, state, notesCount, outreachLogsRaw] = await Promise.all([
        redis.get<LeadCore>(RedisKeys.leadCore(leadId)),
        redis.get<LeadState>(RedisKeys.leadState(leadId)),
        redis.llen(RedisKeys.leadNotes(leadId)),
        redis.lRange(RedisKeys.leadOutreach(leadId), 0, 2),
      ]);

      if (core && state) {
        const outreachLogs: OutreachLog[] = (outreachLogsRaw || [])
          .map((raw) => {
            if (typeof raw === 'string') {
              try {
                return JSON.parse(raw) as OutreachLog;
              } catch {
                return null;
              }
            }
            return raw as OutreachLog;
          })
          .filter((item): item is OutreachLog => item !== null);

        // Apply source filter if provided
        if (sourceFilter && core.source !== sourceFilter) {
          continue;
        }
        const leadMediaType = core.media_type || 'FOCUS_MEDIA';
        if (mediaTypeFilter !== 'ALL' && leadMediaType !== mediaTypeFilter) {
          continue;
        }

        leads.push({
          ...core,
          state,
          notes_count: notesCount || 0,
          outreach_log: outreachLogs,
        });
      }
    }

    let filteredLeads = leads;
    if (statusParam === 'NEW') {
      const config = await redis.get<SalesConfig>(RedisKeys.config());
      const excludedCompanyKeys = buildExcludedCompanySet(config);
      if (excludedCompanyKeys.size > 0) {
        filteredLeads = leads.filter((lead) => {
          const company = lead.ai_analysis?.company_name?.trim();
          if (!company) return true;
          return !excludedCompanyKeys.has(normalizeCompanyKey(company));
        });
      }
    }

    // Sorting
    if (sortBy === 'score') {
      filteredLeads.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));
    } else {
      // Default latest (already mostly correct from Redis, but ensure by created_at)
      filteredLeads.sort((a, b) => b.created_at - a.created_at);
    }

    // Final limit after sorting
    const finalLeads = filteredLeads.slice(0, limit);

    const counts = await getStatusCounts();

    return NextResponse.json({
      success: true,
      leads: finalLeads,
      status: statusParam,
      total: finalLeads.length,
      limit,
      sortBy,
      counts,
    } as LeadsResponse);
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

async function getStatusCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const allCount = await redis.zcard(RedisKeys.idxAll());
  counts.ALL = allCount;

  const statusCounts = await Promise.all(
    ALL_STATUSES.map(async (status) => ({
      status,
      count: await redis.zcard(RedisKeys.idxStatus(status)),
    }))
  );

  for (const item of statusCounts) {
    counts[item.status] = item.count;
  }

  return counts;
}
