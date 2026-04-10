import { NextRequest, NextResponse } from 'next/server';
import { produceCreativePackage } from '@/lib/creativeStudio';
import type { CreativeAssetKind, CreativeAudioMode, CreativeFormat } from '@/lib/types';

export const runtime = 'nodejs';

function parseAssetKinds(value: FormDataEntryValue | null): CreativeAssetKind[] {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean) as CreativeAssetKind[];
}

export async function POST(req: NextRequest) {
  try {
    const openAIApiKey = req.headers.get('x-openai-api-key')?.trim() || undefined;
    const formData = await req.formData();
    const sourceFiles = formData.getAll('source_files').filter(item => item instanceof File) as File[];
    const bgmFile = formData.get('bgm_file');
    if (bgmFile instanceof File && bgmFile.size > 0) {
      sourceFiles.push(bgmFile);
    }

    const manifest = await produceCreativePackage({
      brief: {
        advertiser_name: String(formData.get('advertiser_name') || ''),
        advertiser_industry: String(formData.get('advertiser_industry') || ''),
        campaign_name: String(formData.get('campaign_name') || ''),
        message: String(formData.get('creative_message') || ''),
        notes: String(formData.get('notes') || ''),
        preferred_format: String(formData.get('creative_format') || 'both') as CreativeFormat,
        audio_mode: String(formData.get('creative_audio_mode') || 'bgm_narration') as CreativeAudioMode,
        asset_kinds: parseAssetKinds(formData.get('creative_asset_kinds')),
      },
      sourceFiles,
      openAIApiKey,
    });

    return NextResponse.json(manifest);
  } catch (error) {
    return NextResponse.json({ error: `소재 제작 실패: ${error}` }, { status: 500 });
  }
}
