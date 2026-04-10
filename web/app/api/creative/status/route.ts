import { NextRequest, NextResponse } from 'next/server';
import { readCreativeManifest, refreshCreativePackage } from '@/lib/creativeStudio';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    const refresh = req.nextUrl.searchParams.get('refresh') === 'true';
    const openAIApiKey = req.headers.get('x-openai-api-key')?.trim() || undefined;
    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    const manifest = refresh
      ? await refreshCreativePackage(id, openAIApiKey)
      : await readCreativeManifest(id);

    return NextResponse.json(manifest);
  } catch (error) {
    return NextResponse.json({ error: `상태 조회 실패: ${error}` }, { status: 500 });
  }
}
