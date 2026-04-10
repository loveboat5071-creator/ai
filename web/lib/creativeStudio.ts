import { existsSync } from 'fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'fs/promises';
import { createHash, randomUUID } from 'crypto';
import { join, extname } from 'path';
import { spawn } from 'child_process';
import OpenAI from 'openai';
import ffmpegStatic from 'ffmpeg-static';
import { buildCreativePlan } from './creativePlan';
import { sanitizeFilenameSegment } from './escape';
import type { CreativeAudioMode, CreativeBrief, CreativePlan, CreativeStoryboardScene, CreativeVideoBeat } from './types';

const DEFAULT_PUBLIC_ROOT = join(process.cwd(), 'public', 'generated', 'creative');
const DEFAULT_PUBLIC_BASE_URL = '/generated/creative';
const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1650;
const TARGET_DURATION_SEC = 15;
const DRAFT_IMAGE_WIDTH = 1024;
const DRAFT_IMAGE_HEIGHT = 1536;
const UPSCALED_IMAGE_WIDTH = 2160;
const UPSCALED_IMAGE_HEIGHT = 3300;

const DEFAULT_FONT_CANDIDATES = [
  process.env.CREATIVE_FONT_FILE || '',
  '/System/Library/Fonts/AppleSDGothicNeo.ttc',
  '/System/Library/Fonts/Supplemental/AppleGothic.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
].filter(Boolean);

const DEFAULT_BOLD_FONT_CANDIDATES = [
  process.env.CREATIVE_BOLD_FONT_FILE || '',
  '/System/Library/Fonts/AppleSDGothicNeoB.ttc',
  '/System/Library/Fonts/Supplemental/AppleSDGothicNeoB.ttf',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  ...DEFAULT_FONT_CANDIDATES,
].filter(Boolean);

export interface CreativeAssetRecord {
  id: string;
  kind: 'image' | 'video' | 'audio';
  role: 'source' | 'generated' | 'render' | 'narration' | 'bgm';
  title: string;
  local_path: string;
  url: string;
  mime_type: string;
  source: 'upload' | 'ai' | 'generated';
  size_bytes?: number;
  prompt?: string;
}

export interface CreativeVideoJobRecord {
  key: string;
  title: string;
  prompt: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  video_id?: string;
  error?: string;
  local_path?: string;
  url?: string;
}

export interface CreativeRenderManifest {
  id: string;
  created_at: string;
  status: 'processing' | 'completed' | 'failed' | 'partial';
  brief: CreativeBrief;
  plan: CreativePlan;
  source_assets: CreativeAssetRecord[];
  image_assets: CreativeAssetRecord[];
  output_assets: CreativeAssetRecord[];
  video_jobs: CreativeVideoJobRecord[];
  warnings: string[];
  errors: string[];
}

interface AudioBundle {
  narration?: CreativeAssetRecord;
  bgm?: CreativeAssetRecord;
}

type OverlayWindow = { start: number; end: number; text: string; heading?: string };
type VideoSegmentInput = {
  path: string;
  inputIndex: number;
  duration: number;
  overlays: OverlayWindow[];
};

function getJobDir(jobId: string): string {
  return join(getStorageConfig().rootDir, jobId);
}

function getPublicUrl(jobId: string, ...parts: string[]): string {
  return `${getStorageConfig().publicBaseUrl}/${jobId}/${parts.map(part => encodeURIComponent(part)).join('/')}`;
}

function getStorageConfig(): { rootDir: string; publicBaseUrl: string } {
  const isVercel = Boolean(process.env.VERCEL);
  const configuredRoot = process.env.CREATIVE_STORAGE_ROOT?.trim();
  const configuredPublicBaseUrl = process.env.CREATIVE_PUBLIC_BASE_URL?.trim();
  const rootDir = isVercel
    ? (configuredRoot || '/tmp/focusmap-creative')
    : (configuredRoot || DEFAULT_PUBLIC_ROOT);
  const publicBaseUrl = configuredPublicBaseUrl || DEFAULT_PUBLIC_BASE_URL;

  if (isVercel && !configuredRoot) {
    console.warn('Vercel 환경에서는 기본 임시 저장소(/tmp/focusmap-creative)를 사용합니다. 영구 저장이 필요한 경우 CREATIVE_STORAGE_ROOT를 연결하세요.');
  }

  return {
    rootDir,
    publicBaseUrl,
  };
}

async function ensureJobFolders(jobId: string) {
  const baseDir = getJobDir(jobId);
  await mkdir(join(baseDir, 'sources'), { recursive: true });
  await mkdir(join(baseDir, 'generated'), { recursive: true });
  await mkdir(join(baseDir, 'renders'), { recursive: true });
  return {
    baseDir,
    sourceDir: join(baseDir, 'sources'),
    generatedDir: join(baseDir, 'generated'),
    renderDir: join(baseDir, 'renders'),
    manifestPath: join(baseDir, 'manifest.json'),
  };
}

function inferAssetKind(mimeType: string, fileName = ''): 'image' | 'video' | 'audio' {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  const ext = extname(fileName).toLowerCase();
  if (['.mp4', '.mov', '.m4v', '.avi', '.webm'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg'].includes(ext)) return 'audio';
  return 'image';
}

function inferExtension(mimeType: string, fallbackName: string): string {
  const ext = extname(fallbackName);
  if (ext) return ext.toLowerCase();
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'audio/mpeg') return '.mp3';
  if (mimeType === 'audio/wav') return '.wav';
  if (mimeType === 'video/mp4') return '.mp4';
  return '.bin';
}

async function persistUploads(jobId: string, files: File[]): Promise<CreativeAssetRecord[]> {
  if (files.length === 0) return [];
  const { sourceDir } = await ensureJobFolders(jobId);
  const persisted: CreativeAssetRecord[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const safeBase = sanitizeFilenameSegment(file.name.replace(/\.[^.]+$/, '') || `asset-${index + 1}`);
    const ext = inferExtension(file.type, file.name);
    const fileName = `${String(index + 1).padStart(2, '0')}-${safeBase}${ext}`;
    const absolutePath = join(sourceDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, buffer);
    persisted.push({
      id: createHash('md5').update(`${jobId}:${fileName}`).digest('hex').slice(0, 12),
      kind: inferAssetKind(file.type, file.name),
      role: 'source',
      title: file.name,
      local_path: absolutePath,
      url: getPublicUrl(jobId, 'sources', fileName),
      mime_type: file.type || 'application/octet-stream',
      source: 'upload',
      size_bytes: buffer.byteLength,
    });
  }

  return persisted;
}

function getOpenAIClient(overrideApiKey?: string): OpenAI {
  const apiKey = overrideApiKey?.trim() || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API 키가 필요합니다.');
  }
  return new OpenAI({ apiKey });
}

function hasOpenAIClient(overrideApiKey?: string): boolean {
  return Boolean(overrideApiKey?.trim() || process.env.OPENAI_API_KEY);
}

async function resolveFontFile(): Promise<string> {
  for (const candidate of DEFAULT_FONT_CANDIDATES) {
    try {
      if (!candidate) continue;
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // continue
    }
  }
  throw new Error('렌더링용 한글 폰트를 찾지 못했습니다. CREATIVE_FONT_FILE 환경변수를 설정해주세요.');
}

async function resolveBoldFontFile(): Promise<string> {
  for (const candidate of DEFAULT_BOLD_FONT_CANDIDATES) {
    try {
      if (!candidate) continue;
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // continue
    }
  }
  throw new Error('렌더링용 볼드 한글 폰트를 찾지 못했습니다. CREATIVE_BOLD_FONT_FILE 환경변수를 설정해주세요.');
}

function ensureFfmpegBinary(): string {
  const candidates = [
    process.env.CREATIVE_FFMPEG_BIN || '',
    '/usr/bin/ffmpeg',
    '/bin/ffmpeg',
    ffmpegStatic || '',
    join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    join(process.cwd(), '..', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('ffmpeg-static 바이너리를 찾지 못했습니다.');
}

function summarizeFfmpegError(stderr: string): string {
  const lines = stderr
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const signalLines = lines.filter(line =>
    line.includes('Error') ||
    line.includes('Failed') ||
    line.includes('No such filter') ||
    line.includes('Cannot') ||
    line.includes('Invalid') ||
    line.startsWith('[AV') ||
    line.startsWith('[Parsed_')
  );

  const summary = (signalLines.length > 0 ? signalLines : lines.slice(-8)).join('\n');
  return summary || 'ffmpeg 실행 중 오류가 발생했습니다.';
}

function escapeDrawtext(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\\\'")
    .replace(/%/g, '\\%')
    .replace(/\n/g, '\\n');
}

function wrapOverlayLines(value: string, maxChars = 18, maxLines = 3): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines - 1);
  visible.push(lines.slice(maxLines - 1).join(' '));
  return visible;
}

function buildOverlayLabel(brief: CreativeBrief, fallback: string): string {
  return brief.advertiser_name?.trim() || brief.campaign_name?.trim() || fallback;
}

function chooseTtsVoice(plan: CreativePlan): string {
  if (plan.profile_label.includes('병원')) return 'sage';
  if (plan.profile_label.includes('학원')) return 'verse';
  return 'alloy';
}

function buildImagePrompt(
  brief: CreativeBrief,
  scene: CreativeStoryboardScene,
  plan: CreativePlan,
): string {
  const advertiser = brief.advertiser_name || '로컬 광고주';
  const industry = brief.advertiser_industry || plan.profile_label;
  return [
    'Use case: photorealistic-natural',
    'Asset type: elevator ad still image',
    `Campaign context: ${advertiser} ${industry} 광고용 비주얼. 이 정보는 장면 톤 참고용이며 이미지 안에 브랜드명이나 문구로 표시하면 안 됩니다.`,
    `Primary request: 세로형 광고용 상업 비주얼. ${scene.visual}`,
    `Scene/background: ${industry} 업종에 맞는 상업 촬영 느낌, 세로형 1080x1650 안전 구도`,
    `Subject: ${scene.visual}`,
    'Style/medium: photorealistic premium commercial photography',
    'Composition/framing: vertical poster composition, clear subject separation, generous clean negative space for later subtitle overlay',
    'Lighting/mood: premium, clean, approachable, high-contrast but natural',
    `Color palette: ${plan.recommended_keywords.join(', ')}`,
    'Hard constraint: do not render any letters, words, numbers, logos, signage, menu boards, coupons, posters, QR codes, or typography anywhere in the image.',
    'Hard constraint: if a sign, storefront, package, or display appears, keep it blank or abstract with no readable marks.',
    'Hard constraint: final Korean copy will be composited separately, so the generated image itself must contain zero visible text.',
    'Constraints: no embedded captions, no watermark, safe-for-work, family-friendly',
    'Avoid: clutter, distorted anatomy, duplicated objects, stock photo vibe, oversaturated neon, fake text, unreadable signage',
  ].join('\n');
}

function buildSoraPrompt(
  brief: CreativeBrief,
  headline: string,
  visuals: string[],
  timing: string,
): string {
  const advertiser = brief.advertiser_name || '로컬 광고주';
  const industry = brief.advertiser_industry || '로컬 비즈니스';
  return [
    'Use case: vertical elevator ad video',
    `Campaign context: ${advertiser} ${industry} 광고용 세로형 상업 영상. 이 정보는 분위기 참고용이며 영상 안에 브랜드명이나 문구를 직접 노출하면 안 됩니다.`,
    `Primary request: ${industry} 업종에 맞는 세로형 상업 영상`,
    `Scene/background: ${industry} 업종에 어울리는 프리미엄 광고 공간`,
    `Subject: ${visuals.join(', ')}`,
    'Action: smooth commercial reveal, subtle product/service emphasis, end with strong CTA atmosphere',
    'Camera: slow push-in, controlled lateral movement, no shaky handheld',
    'Lighting/mood: polished, premium, bright, inviting',
    'Style/format: high-end commercial, vertical framing, no burnt-in text, no watermark',
    `Timing/beats: ${timing}`,
    'Audio: no dialogue, leave room for added voiceover and background music',
    'Hard constraint: do not render any visible Korean or English text, numbers, logos, QR codes, packaging labels, storefront names, or posters in the frames.',
    'Hard constraint: any signboard or display must stay blank or out of focus with no readable marks.',
    `Messaging intent only: "${headline}". This message is for editing intent and must not appear as on-screen text inside the generated video.`,
    'Constraints: fictional adults only if people appear, family friendly, no copyrighted characters, no brand watermarks, no embedded captions',
    'Avoid: flicker, jitter, warped hands, unreadable signage, frame jumps, fake typography',
  ].join('\n');
}

async function generateDraftImageAsset(
  client: OpenAI,
  jobId: string,
  scene: CreativeStoryboardScene,
  brief: CreativeBrief,
  plan: CreativePlan,
  index: number,
): Promise<CreativeAssetRecord> {
  const { generatedDir } = await ensureJobFolders(jobId);
  const prompt = buildImagePrompt(brief, scene, plan);
  const result = await client.images.generate({
    model: 'gpt-image-1-mini',
    prompt,
    size: `${DRAFT_IMAGE_WIDTH}x${DRAFT_IMAGE_HEIGHT}`,
    quality: 'low',
    output_format: 'png',
  });
  const image = result.data?.[0]?.b64_json;
  if (!image) {
    throw new Error(`${scene.title} 이미지 생성 결과가 비어 있습니다.`);
  }
  const fileName = `scene-${index + 1}-draft.png`;
  const absolutePath = join(generatedDir, fileName);
  const buffer = Buffer.from(image, 'base64');
  await writeFile(absolutePath, buffer);
  return {
    id: createHash('md5').update(`${jobId}:generated:${fileName}`).digest('hex').slice(0, 12),
    kind: 'image',
    role: 'generated',
    title: scene.title,
    local_path: absolutePath,
    url: getPublicUrl(jobId, 'generated', fileName),
    mime_type: 'image/png',
    source: 'ai',
    size_bytes: buffer.byteLength,
    prompt,
  };
}

async function upscaleImageAsset(
  jobId: string,
  draftAsset: CreativeAssetRecord,
  index: number,
): Promise<CreativeAssetRecord> {
  const { generatedDir } = await ensureJobFolders(jobId);
  const fileName = `scene-${index + 1}.png`;
  const absolutePath = join(generatedDir, fileName);
  await runFfmpeg([
    '-y',
    '-i',
    draftAsset.local_path,
    '-vf',
    [
      `scale=${UPSCALED_IMAGE_WIDTH}:${UPSCALED_IMAGE_HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos`,
      `crop=${UPSCALED_IMAGE_WIDTH}:${UPSCALED_IMAGE_HEIGHT}`,
      'unsharp=5:5:0.8:3:3:0.4',
    ].join(','),
    absolutePath,
  ]);
  const info = await stat(absolutePath);
  return {
    ...draftAsset,
    local_path: absolutePath,
    url: getPublicUrl(jobId, 'generated', fileName),
    size_bytes: info.size,
  };
}

async function generateNarrationAsset(
  client: OpenAI,
  jobId: string,
  brief: CreativeBrief,
  plan: CreativePlan,
): Promise<CreativeAssetRecord> {
  const { generatedDir } = await ensureJobFolders(jobId);
  const script = plan.audio.narration_lines.join(' ');
  const voice = chooseTtsVoice(plan);
  const speech = await client.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice,
    input: script,
    response_format: 'mp3',
    instructions: `${brief.advertiser_industry || plan.profile_label} 광고용 한국어 내레이션입니다. 또렷하고 신뢰감 있게 읽어주세요.`,
  });
  const buffer = Buffer.from(await speech.arrayBuffer());
  const fileName = 'narration.mp3';
  const absolutePath = join(generatedDir, fileName);
  await writeFile(absolutePath, buffer);
  return {
    id: createHash('md5').update(`${jobId}:narration`).digest('hex').slice(0, 12),
    kind: 'audio',
    role: 'narration',
    title: 'AI 멘트',
    local_path: absolutePath,
    url: getPublicUrl(jobId, 'generated', fileName),
    mime_type: 'audio/mpeg',
    source: 'ai',
    size_bytes: buffer.byteLength,
  };
}

async function generateAmbientBgm(jobId: string): Promise<CreativeAssetRecord> {
  const { generatedDir } = await ensureJobFolders(jobId);
  const absolutePath = join(generatedDir, 'ambient-bgm.mp3');
  await runFfmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    `aevalsrc=0.06*sin(2*PI*220*t)+0.04*sin(2*PI*277*t)+0.03*sin(2*PI*330*t):s=44100:d=${TARGET_DURATION_SEC}`,
    '-af',
    'afade=t=in:st=0:d=1.5,afade=t=out:st=13.2:d=1.8,volume=0.65',
    '-q:a',
    '4',
    absolutePath,
  ]);
  const info = await stat(absolutePath);
  return {
    id: createHash('md5').update(`${jobId}:ambient-bgm`).digest('hex').slice(0, 12),
    kind: 'audio',
    role: 'bgm',
    title: '기본 BGM',
    local_path: absolutePath,
    url: getPublicUrl(jobId, 'generated', 'ambient-bgm.mp3'),
    mime_type: 'audio/mpeg',
    source: 'generated',
    size_bytes: info.size,
  };
}

async function runFfmpeg(args: string[]): Promise<void> {
  const ffmpegBinary = ensureFfmpegBinary();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegBinary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(summarizeFfmpegError(stderr) || `ffmpeg exited with code ${code}`));
    });
  });
}

function buildLabeledVideoFilter(inputLabel: string, filters: string[], outputLabel: string): string {
  return `${inputLabel}${filters.filter(Boolean).join(',')}${outputLabel}`;
}

function buildAudioFilter(
  audioMode: CreativeAudioMode,
  narrationInputIndex: number | null,
  bgmInputIndex: number | null,
): { filter: string; mapLabel: string } | null {
  if (audioMode === 'narration_only' && narrationInputIndex != null) {
    return {
      filter: `[${narrationInputIndex}:a]atrim=0:${TARGET_DURATION_SEC},apad=pad_dur=${TARGET_DURATION_SEC}[aout]`,
      mapLabel: '[aout]',
    };
  }
  if (audioMode === 'bgm_only' && bgmInputIndex != null) {
    return {
      filter: `[${bgmInputIndex}:a]atrim=0:${TARGET_DURATION_SEC},apad=pad_dur=${TARGET_DURATION_SEC},volume=0.55[aout]`,
      mapLabel: '[aout]',
    };
  }
  if (narrationInputIndex != null && bgmInputIndex != null) {
    return {
      filter: `[${narrationInputIndex}:a]atrim=0:${TARGET_DURATION_SEC},apad=pad_dur=${TARGET_DURATION_SEC},volume=1.1[narr];` +
        `[${bgmInputIndex}:a]atrim=0:${TARGET_DURATION_SEC},apad=pad_dur=${TARGET_DURATION_SEC},volume=0.22[bgm];` +
        `[bgm][narr]amix=inputs=2:duration=longest:weights='0.35 1.0',atrim=0:${TARGET_DURATION_SEC}[aout]`,
      mapLabel: '[aout]',
    };
  }
  if (narrationInputIndex != null) {
    return {
      filter: `[${narrationInputIndex}:a]atrim=0:${TARGET_DURATION_SEC},apad=pad_dur=${TARGET_DURATION_SEC}[aout]`,
      mapLabel: '[aout]',
    };
  }
  if (bgmInputIndex != null) {
    return {
      filter: `[${bgmInputIndex}:a]atrim=0:${TARGET_DURATION_SEC},apad=pad_dur=${TARGET_DURATION_SEC},volume=0.55[aout]`,
      mapLabel: '[aout]',
    };
  }
  return null;
}

async function renderImageAd(
  jobId: string,
  brief: CreativeBrief,
  scenes: CreativeStoryboardScene[],
  imageAssets: CreativeAssetRecord[],
  audioBundle: AudioBundle,
  audioMode: CreativeAudioMode,
): Promise<CreativeAssetRecord> {
  const { renderDir } = await ensureJobFolders(jobId);
  const fontFile = await resolveFontFile();
  const boldFontFile = await resolveBoldFontFile();
  const outPath = join(renderDir, 'image-ad.mp4');
  const args = ['-y'];

  imageAssets.forEach(asset => {
    const scene = scenes.find(item => item.title === asset.title);
    const duration = scene?.duration_sec ?? 5;
    args.push('-loop', '1', '-t', String(duration), '-i', asset.local_path);
  });

  let narrationInputIndex: number | null = null;
  let bgmInputIndex: number | null = null;
  if (audioBundle.narration) {
    narrationInputIndex = imageAssets.length;
    args.push('-i', audioBundle.narration.local_path);
  }
  if (audioBundle.bgm) {
    bgmInputIndex = imageAssets.length + (audioBundle.narration ? 1 : 0);
    args.push('-stream_loop', '-1', '-i', audioBundle.bgm.local_path);
  }

  const visualFilters = imageAssets.map((asset, index) => {
    const scene = scenes[index] || scenes.find(item => item.title === asset.title);
    const label = escapeDrawtext(buildOverlayLabel(brief, scene?.title || asset.title));
    const copyLines = wrapOverlayLines(scene?.copy || '', 11, 3);
    return buildLabeledVideoFilter(
      `[${index}:v]`,
      [
        `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=increase`,
        `crop=${TARGET_WIDTH}:${TARGET_HEIGHT}`,
        'setsar=1',
        'format=yuv420p',
        'drawbox=x=36:y=1184:w=iw-72:h=360:color=black@0.18:t=fill',
        'drawbox=x=48:y=1196:w=iw-96:h=336:color=0x0f172a@0.72:t=fill',
        'drawbox=x=48:y=1196:w=iw-96:h=8:color=0xf59e0b@0.95:t=fill',
        `drawtext=fontfile='${fontFile}':text='${label}':fontcolor=0xf8d38a:fontsize=30:x=84:y=1238:borderw=0:shadowx=0:shadowy=2:shadowcolor=0x000000@0.25`,
        ...copyLines.map((line, lineIndex) =>
          `drawtext=fontfile='${boldFontFile}':text='${escapeDrawtext(line)}':fontcolor=0xfffaf4:fontsize=58:x=84:y=${1294 + (lineIndex * 72)}:borderw=3:bordercolor=0x111827@0.45:shadowx=0:shadowy=8:shadowcolor=0x000000@0.28`
        ),
      ],
      `[v${index}]`,
    );
  });

  const concatLabel = imageAssets.map((_, index) => `[v${index}]`).join('');
  const filterParts = [
    ...visualFilters,
    `${concatLabel}concat=n=${imageAssets.length}:v=1:a=0[vv]`,
  ];

  const audioFilter = buildAudioFilter(audioMode, narrationInputIndex, bgmInputIndex);
  if (audioFilter) filterParts.push(audioFilter.filter);

  args.push(
    '-filter_complex',
    filterParts.join(';'),
    '-map',
    '[vv]',
  );
  if (audioFilter) {
    args.push('-map', audioFilter.mapLabel);
  }
  args.push(
    '-t',
    String(TARGET_DURATION_SEC),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    outPath,
  );

  await runFfmpeg(args);
  const info = await stat(outPath);
  return {
    id: createHash('md5').update(`${jobId}:image-ad`).digest('hex').slice(0, 12),
    kind: 'video',
    role: 'render',
    title: '이미지형 광고 영상',
    local_path: outPath,
    url: getPublicUrl(jobId, 'renders', 'image-ad.mp4'),
    mime_type: 'video/mp4',
    source: 'generated',
    size_bytes: info.size,
  };
}

function buildImageRenderScenes(plan: CreativePlan, uploadedImageCount: number): CreativeStoryboardScene[] {
  if (uploadedImageCount === 2) {
    const [firstScene, secondScene, thirdScene] = plan.image_package.scenes;
    return [
      {
        ...firstScene,
        duration_sec: TARGET_DURATION_SEC / 2,
      },
      {
        title: secondScene?.title || '2컷',
        duration_sec: TARGET_DURATION_SEC / 2,
        visual: secondScene?.visual || thirdScene?.visual || firstScene?.visual || '',
        copy: [secondScene?.copy, thirdScene?.copy].filter(Boolean).join(' / ') || secondScene?.copy || thirdScene?.copy || '',
      },
    ];
  }
  return plan.image_package.scenes;
}

function bindImageAssetToScene(asset: CreativeAssetRecord, scene: CreativeStoryboardScene): CreativeAssetRecord {
  return {
    ...asset,
    title: scene.title,
  };
}

function buildVideoMontageSegments(
  clipPaths: string[],
  beats: CreativeVideoBeat[],
): VideoSegmentInput[] {
  if (clipPaths.length === 0) return [];
  if (clipPaths.length >= 3) {
    return [
      { path: clipPaths[0], inputIndex: 0, duration: 5, overlays: [{ start: 0, end: 5, text: beats[0]?.copy || '', heading: beats[0]?.time_range || '0-5초' }] },
      { path: clipPaths[1], inputIndex: 1, duration: 5, overlays: [{ start: 0, end: 5, text: beats[1]?.copy || '', heading: beats[1]?.time_range || '5-10초' }] },
      { path: clipPaths[2], inputIndex: 2, duration: 5, overlays: [{ start: 0, end: 5, text: beats[2]?.copy || '', heading: beats[2]?.time_range || '10-15초' }] },
    ];
  }
  if (clipPaths.length === 2) {
    return [
      {
        path: clipPaths[0],
        inputIndex: 0,
        duration: 8,
        overlays: [
          { start: 0, end: 4, text: beats[0]?.copy || '', heading: beats[0]?.time_range || '0-4초' },
          { start: 4, end: 8, text: beats[1]?.copy || '', heading: beats[1]?.time_range || '4-8초' },
        ],
      },
      {
        path: clipPaths[1],
        inputIndex: 1,
        duration: 7,
        overlays: [{ start: 0, end: 7, text: beats[2]?.copy || '', heading: beats[2]?.time_range || '8-15초' }],
      },
    ];
  }
  return [
    {
      path: clipPaths[0],
      inputIndex: 0,
      duration: 15,
      overlays: [
        { start: 0, end: 5, text: beats[0]?.copy || '', heading: beats[0]?.time_range || '0-5초' },
        { start: 5, end: 10, text: beats[1]?.copy || '', heading: beats[1]?.time_range || '5-10초' },
        { start: 10, end: 15, text: beats[2]?.copy || '', heading: beats[2]?.time_range || '10-15초' },
      ],
    },
  ];
}

async function renderVideoMontage(
  jobId: string,
  brief: CreativeBrief,
  outputFileName: string,
  title: string,
  clipPaths: string[],
  beats: CreativeVideoBeat[],
  audioBundle: AudioBundle,
  audioMode: CreativeAudioMode,
): Promise<CreativeAssetRecord> {
  const { renderDir } = await ensureJobFolders(jobId);
  const fontFile = await resolveFontFile();
  const boldFontFile = await resolveBoldFontFile();
  const segments = buildVideoMontageSegments(clipPaths, beats);
  const outPath = join(renderDir, outputFileName);
  const args = ['-y'];

  segments.forEach(segment => {
    args.push('-i', segment.path);
  });

  let narrationInputIndex: number | null = null;
  let bgmInputIndex: number | null = null;
  if (audioBundle.narration) {
    narrationInputIndex = segments.length;
    args.push('-i', audioBundle.narration.local_path);
  }
  if (audioBundle.bgm) {
    bgmInputIndex = segments.length + (audioBundle.narration ? 1 : 0);
    args.push('-stream_loop', '-1', '-i', audioBundle.bgm.local_path);
  }

  const visualFilters = segments.map((segment, idx) => {
    const overlayFilters = segment.overlays.flatMap((overlay) => {
      const escapedHeading = escapeDrawtext(buildOverlayLabel(brief, overlay.heading || '광고 정보'));
      const overlayLines = wrapOverlayLines(overlay.text, 11, 3);
      return [
        `drawtext=fontfile='${fontFile}':text='${escapedHeading}':fontcolor=0xf8d38a:fontsize=28:x=84:y=1238:borderw=0:shadowx=0:shadowy=2:shadowcolor=0x000000@0.25:enable='between(t,${overlay.start},${overlay.end})'`,
        ...overlayLines.map((line, lineIndex) =>
          `drawtext=fontfile='${boldFontFile}':text='${escapeDrawtext(line)}':fontcolor=0xfffaf4:fontsize=56:x=84:y=${1294 + (lineIndex * 70)}:borderw=3:bordercolor=0x111827@0.45:shadowx=0:shadowy=8:shadowcolor=0x000000@0.28:enable='between(t,${overlay.start},${overlay.end})'`
        ),
      ];
    });
    return buildLabeledVideoFilter(
      `[${segment.inputIndex}:v]`,
      [
        `trim=0:${segment.duration}`,
        'setpts=PTS-STARTPTS',
        `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=increase`,
        `crop=${TARGET_WIDTH}:${TARGET_HEIGHT}`,
        'setsar=1',
        'format=yuv420p',
        'drawbox=x=36:y=1184:w=iw-72:h=360:color=black@0.18:t=fill',
        'drawbox=x=48:y=1196:w=iw-96:h=336:color=0x0f172a@0.70:t=fill',
        'drawbox=x=48:y=1196:w=iw-96:h=8:color=0xf59e0b@0.95:t=fill',
        ...overlayFilters,
      ],
      `[v${idx}]`,
    );
  });

  const filterParts = [
    ...visualFilters,
    `${segments.map((_, idx) => `[v${idx}]`).join('')}concat=n=${segments.length}:v=1:a=0[vv]`,
  ];
  const audioFilter = buildAudioFilter(audioMode, narrationInputIndex, bgmInputIndex);
  if (audioFilter) filterParts.push(audioFilter.filter);

  args.push('-filter_complex', filterParts.join(';'), '-map', '[vv]');
  if (audioFilter) {
    args.push('-map', audioFilter.mapLabel);
  }
  args.push(
    '-t',
    String(TARGET_DURATION_SEC),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    outPath,
  );

  await runFfmpeg(args);
  const info = await stat(outPath);
  return {
    id: createHash('md5').update(`${jobId}:${outputFileName}`).digest('hex').slice(0, 12),
    kind: 'video',
    role: 'render',
    title,
    local_path: outPath,
    url: getPublicUrl(jobId, 'renders', outputFileName),
    mime_type: 'video/mp4',
    source: 'generated',
    size_bytes: info.size,
  };
}

async function saveManifest(manifest: CreativeRenderManifest): Promise<void> {
  const { manifestPath } = await ensureJobFolders(manifest.id);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

export async function readCreativeManifest(jobId: string): Promise<CreativeRenderManifest> {
  const { manifestPath } = await ensureJobFolders(jobId);
  const raw = await readFile(manifestPath, 'utf-8');
  return JSON.parse(raw) as CreativeRenderManifest;
}

export async function listCreativeHistory(limit = 12): Promise<CreativeRenderManifest[]> {
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const { rootDir } = getStorageConfig();

  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    const manifests = await Promise.all(
      entries
        .filter(entry => entry.isDirectory())
        .map(async entry => {
          try {
            const raw = await readFile(join(rootDir, entry.name, 'manifest.json'), 'utf-8');
            return JSON.parse(raw) as CreativeRenderManifest;
          } catch {
            return null;
          }
        }),
    );

    return manifests
      .filter((item): item is CreativeRenderManifest => Boolean(item))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, safeLimit);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function summarizeStatus(manifest: CreativeRenderManifest): CreativeRenderManifest['status'] {
  if (manifest.errors.length > 0 && manifest.output_assets.length === 0 && manifest.image_assets.length === 0) {
    return 'failed';
  }
  if (manifest.video_jobs.some(job => job.status === 'queued' || job.status === 'in_progress')) {
    return manifest.output_assets.length > 0 ? 'partial' : 'processing';
  }
  if (manifest.errors.length > 0) return 'partial';
  return 'completed';
}

async function buildAudioBundle(
  jobId: string,
  brief: CreativeBrief,
  plan: CreativePlan,
  sourceAssets: CreativeAssetRecord[],
  openAIApiKey?: string,
): Promise<AudioBundle> {
  const audioUploads = sourceAssets.filter(asset => asset.kind === 'audio');
  const uploadedBgm = audioUploads[0];
  const bundle: AudioBundle = {};
  const needsNarration = plan.audio.mode !== 'bgm_only';
  const needsBgm = plan.audio.mode !== 'narration_only';
  const client = hasOpenAIClient(openAIApiKey) ? getOpenAIClient(openAIApiKey) : null;

  if (needsNarration) {
    if (!client) {
      throw new Error('멘트 생성에는 OpenAI API 키가 필요합니다.');
    }
    bundle.narration = await generateNarrationAsset(client, jobId, brief, plan);
  }

  if (needsBgm) {
    if (uploadedBgm) {
      bundle.bgm = {
        ...uploadedBgm,
        role: 'bgm',
      };
    } else {
      bundle.bgm = await generateAmbientBgm(jobId);
    }
  }

  return bundle;
}

function pickImageSceneAssets(
  sourceAssets: CreativeAssetRecord[],
): CreativeAssetRecord[] {
  return sourceAssets.filter(asset => asset.kind === 'image');
}

function pickVideoSourceAssets(
  sourceAssets: CreativeAssetRecord[],
): CreativeAssetRecord[] {
  return sourceAssets.filter(asset => asset.kind === 'video');
}

async function createSoraJobs(
  client: OpenAI,
  manifest: CreativeRenderManifest,
): Promise<CreativeVideoJobRecord[]> {
  const beat0 = manifest.plan.video_package.beats[0];
  const beat1 = manifest.plan.video_package.beats[1];
  const beat2 = manifest.plan.video_package.beats[2];
  const prompts = [
    {
      key: 'segment-1',
      title: '동영상형 1구간',
      prompt: buildSoraPrompt(
        manifest.brief,
        beat0?.copy || '',
        [beat0?.visual || '', beat1?.visual || ''].filter(Boolean),
        `${beat0?.time_range || '0-4초'} ${beat0?.visual || ''}; ${beat1?.time_range || '4-8초'} ${beat1?.visual || ''}`,
      ),
    },
    {
      key: 'segment-2',
      title: '동영상형 2구간',
      prompt: buildSoraPrompt(
        manifest.brief,
        beat2?.copy || '',
        [beat2?.visual || ''].filter(Boolean),
        `${beat2?.time_range || '8-15초'} ${beat2?.visual || ''}`,
      ),
    },
  ];

  const created: CreativeVideoJobRecord[] = [];
  for (const item of prompts) {
    const video = await client.videos.create({
      model: 'sora-2',
      prompt: item.prompt,
      size: '720x1280',
      seconds: '8',
    });
    created.push({
      key: item.key,
      title: item.title,
      prompt: item.prompt,
      status: video.status,
      video_id: video.id,
    });
  }

  return created;
}

function collectExistingOutput(manifest: CreativeRenderManifest, title: string): CreativeAssetRecord | undefined {
  return manifest.output_assets.find(asset => asset.title === title);
}

export async function produceCreativePackage(params: {
  brief: CreativeBrief;
  sourceFiles: File[];
  openAIApiKey?: string;
}): Promise<CreativeRenderManifest> {
  const jobId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const plan = buildCreativePlan(params.brief);
  const sourceAssets = await persistUploads(jobId, params.sourceFiles);
  const manifest: CreativeRenderManifest = {
    id: jobId,
    created_at: new Date().toISOString(),
    status: 'processing',
    brief: params.brief,
    plan,
    source_assets: sourceAssets,
    image_assets: [],
    output_assets: [],
    video_jobs: [],
    warnings: [],
    errors: [],
  };

  await saveManifest(manifest);

  let audioBundle: AudioBundle | null = null;
  try {
    audioBundle = await buildAudioBundle(jobId, params.brief, plan, sourceAssets, params.openAIApiKey);
    if (audioBundle.narration) manifest.output_assets.push(audioBundle.narration);
    if (audioBundle.bgm) manifest.output_assets.push(audioBundle.bgm);
  } catch (error) {
    manifest.errors.push(String(error));
  }

  const uploadedImages = pickImageSceneAssets(sourceAssets);
  const uploadedVideos = pickVideoSourceAssets(sourceAssets);
  const client = hasOpenAIClient(params.openAIApiKey) ? getOpenAIClient(params.openAIApiKey) : null;

  if (params.brief.preferred_format !== 'video') {
    const requiredScenes = buildImageRenderScenes(plan, uploadedImages.length);
    try {
      for (let index = 0; index < requiredScenes.length; index += 1) {
        const uploaded = uploadedImages[index];
        if (uploaded) {
          manifest.image_assets.push(bindImageAssetToScene(uploaded, requiredScenes[index]));
          continue;
        }
        if (!client) {
          throw new Error('이미지 AI 생성에는 OpenAI API 키가 필요합니다. 또는 2~3장의 이미지를 업로드해주세요.');
        }
        const generatedDraft = await generateDraftImageAsset(client, jobId, requiredScenes[index], params.brief, plan, index);
        const upscaled = await upscaleImageAsset(jobId, generatedDraft, index);
        manifest.image_assets.push(upscaled);
      }

      if (manifest.image_assets.some(asset => asset.source === 'ai')) {
        manifest.warnings.push('AI 이미지는 비용 절감을 위해 저해상도 초안으로 생성한 뒤 서버에서 2160x3300으로 업스케일해 사용했습니다.');
      }

      if (audioBundle) {
        const imageVideo = await renderImageAd(jobId, params.brief, requiredScenes, manifest.image_assets, audioBundle, plan.audio.mode);
        manifest.output_assets.push(imageVideo);
      } else {
        manifest.warnings.push('오디오가 준비되지 않아 이미지형 최종 영상은 생성되지 않았습니다.');
      }
    } catch (error) {
      manifest.errors.push(String(error));
    }
  }

  if (params.brief.preferred_format !== 'image') {
    try {
      if (uploadedVideos.length > 0) {
        if (!audioBundle) {
          throw new Error('동영상형 합성에 필요한 오디오를 준비하지 못했습니다.');
        }
        const videoAd = await renderVideoMontage(
          jobId,
          params.brief,
          'video-ad.mp4',
          '동영상형 광고 영상',
          uploadedVideos.map(asset => asset.local_path),
          plan.video_package.beats,
          audioBundle,
          plan.audio.mode,
        );
        manifest.output_assets.push(videoAd);
      } else if (client) {
        manifest.video_jobs = await createSoraJobs(client, manifest);
        if (manifest.video_jobs.length > 0) {
          manifest.warnings.push('동영상형 AI 클립은 비용 절감을 위해 720x1280 초안으로 생성한 뒤 1080x1650 편집본으로 마무리합니다.');
        }
      } else {
        manifest.errors.push('동영상형 생성에는 OpenAI API 키가 필요합니다. 또는 편집할 원본 영상을 업로드해주세요.');
      }
    } catch (error) {
      manifest.errors.push(String(error));
    }
  }

  manifest.status = summarizeStatus(manifest);
  await saveManifest(manifest);
  return manifest;
}

export async function refreshCreativePackage(jobId: string, openAIApiKey?: string): Promise<CreativeRenderManifest> {
  const manifest = await readCreativeManifest(jobId);
  if (manifest.video_jobs.length === 0 || manifest.video_jobs.every(job => job.status === 'completed' || job.status === 'failed')) {
    manifest.status = summarizeStatus(manifest);
    await saveManifest(manifest);
    return manifest;
  }

  const client = getOpenAIClient(openAIApiKey);
  const { generatedDir } = await ensureJobFolders(jobId);
  for (const job of manifest.video_jobs) {
    if (!job.video_id || job.status === 'completed' || job.status === 'failed') continue;
    try {
      const video = await client.videos.retrieve(job.video_id);
      job.status = video.status;
      if (video.status === 'failed') {
        job.error = video.error?.message || '동영상 생성 실패';
      }
      if (video.status === 'completed' && !job.local_path) {
        const response = await client.videos.downloadContent(job.video_id, { variant: 'video' });
        const buffer = Buffer.from(await response.arrayBuffer());
        const fileName = `${job.key}.mp4`;
        const absolutePath = join(generatedDir, fileName);
        await writeFile(absolutePath, buffer);
        job.local_path = absolutePath;
        job.url = getPublicUrl(jobId, 'generated', fileName);
      }
    } catch (error) {
      job.status = 'failed';
      job.error = String(error);
    }
  }

  const completedPaths = manifest.video_jobs
    .filter(job => job.status === 'completed' && job.local_path)
    .map(job => job.local_path as string);

  if (completedPaths.length > 0 && !collectExistingOutput(manifest, '동영상형 광고 영상')) {
    try {
      const narration = manifest.output_assets.find(asset => asset.role === 'narration');
      const bgm = manifest.output_assets.find(asset => asset.role === 'bgm');
      if (!narration && !bgm) {
        throw new Error('동영상형 최종 합성에 필요한 오디오 자산이 없습니다.');
      }
      const videoAd = await renderVideoMontage(
        jobId,
        manifest.brief,
        'video-ad.mp4',
        '동영상형 광고 영상',
        completedPaths,
        manifest.plan.video_package.beats,
        {
          narration,
          bgm,
        },
        manifest.plan.audio.mode,
      );
      manifest.output_assets.push(videoAd);
    } catch (error) {
      manifest.errors.push(String(error));
    }
  }

  manifest.status = summarizeStatus(manifest);
  await saveManifest(manifest);
  return manifest;
}
