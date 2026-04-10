/**
 * 사용 기록 (Activity Log) API
 * GET  /api/logs — 로그 조회
 * POST /api/logs — 로그 추가
 */
import { NextRequest, NextResponse } from 'next/server';
import { appendActivityLog, getClientIp, readActivityLogs } from '@/lib/activityLog';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await appendActivityLog({
      action: body.action,
      address: body.address || '',
      radii: Array.isArray(body.radii) ? body.radii.map(Number) : [],
      resultCount: typeof body.resultCount === 'number' ? body.resultCount : undefined,
      advertiserName: body.advertiserName || '',
      campaignName: body.campaignName || '',
      ip: getClientIp(req.headers),
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await readActivityLogs();
    return NextResponse.json({
      enabled: result.enabled,
      message: result.message,
      logs: result.logs,
      total: result.logs.length,
    });
  } catch {
    return NextResponse.json({
      enabled: false,
      message: '활동 로그를 불러오지 못했습니다.',
      logs: [],
      total: 0,
    });
  }
}
