import { NextRequest, NextResponse } from 'next/server';
import { buildCreativePlan } from '@/lib/creativePlan';
import type { CreativeAssetKind, CreativeAudioMode, CreativeFormat } from '@/lib/types';

export const runtime = 'nodejs';

function normalizeAssetKinds(value: unknown): CreativeAssetKind[] {
  if (Array.isArray(value)) {
    return value.map(String) as CreativeAssetKind[];
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean) as CreativeAssetKind[];
  }
  return [];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const plan = buildCreativePlan({
      advertiser_name: String(body.advertiser_name || ''),
      advertiser_industry: String(body.advertiser_industry || ''),
      campaign_name: String(body.campaign_name || ''),
      message: String(body.creative_message || body.message || ''),
      notes: String(body.notes || ''),
      preferred_format: String(body.creative_format || body.preferred_format || 'both') as CreativeFormat,
      audio_mode: String(body.creative_audio_mode || body.audio_mode || 'bgm_narration') as CreativeAudioMode,
      asset_kinds: normalizeAssetKinds(body.creative_asset_kinds || body.asset_kinds),
    });

    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json({ error: `기획안 생성 실패: ${error}` }, { status: 500 });
  }
}
