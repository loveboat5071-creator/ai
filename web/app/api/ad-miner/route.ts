import { NextRequest, NextResponse } from 'next/server';
import { appendAdMinerRecord, listAdMinerRecords } from '@/lib/adMinerStore';
import { verifySessionToken } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getBearerToken(req: NextRequest): string {
  const authHeader = req.headers.get('authorization') || '';
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch?.[1]) return bearerMatch[1].trim();

  const cookieToken = req.cookies.get('wm_session')?.value;
  return cookieToken?.trim() || '';
}

async function requireMinerSession(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return { error: NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 }) };
  }

  const session = await verifySessionToken(token, 'miner');
  if (!session) {
    return { error: NextResponse.json({ success: false, error: '세션이 만료되었거나 유효하지 않습니다.' }, { status: 401 }) };
  }

  return { session };
}

export async function GET(req: NextRequest) {
  const auth = await requireMinerSession(req);
  if ('error' in auth) return auth.error;

  const limit = Number(req.nextUrl.searchParams.get('limit') || '100');
  const records = await listAdMinerRecords(limit);

  return NextResponse.json({
    success: true,
    count: records.length,
    records,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireMinerSession(req);
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: '전송할 데이터가 올바르지 않습니다.' }, { status: 400 });
    }

    const record = await appendAdMinerRecord(body as Record<string, unknown>);

    return NextResponse.json({
      success: true,
      record,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `저장에 실패했습니다: ${error}` },
      { status: 500 },
    );
  }
}
