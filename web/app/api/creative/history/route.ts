import { NextRequest, NextResponse } from 'next/server';
import { listCreativeHistory } from '@/lib/creativeStudio';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get('limit') || '12');
    const items = await listCreativeHistory(limit);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: `이력 조회 실패: ${error}` }, { status: 500 });
  }
}
