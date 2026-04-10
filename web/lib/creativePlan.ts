import type {
  CreativeAssetKind,
  CreativeAudioMode,
  CreativeBrief,
  CreativeFormat,
  CreativePlan,
  CreativeStoryboardScene,
  CreativeVideoBeat,
} from './types';

type CreativeProfilePreset = {
  label: string;
  conceptTitle: string;
  conceptSummary: string;
  keywords: string[];
  imageVisuals: string[];
  fallbackCopies: string[];
  videoStyle: string;
  videoVisuals: string[];
  bgm: string;
  narration: string[];
  requiredAssets: string[];
};

export const CREATIVE_FORMAT_LABELS: Record<CreativeFormat, string> = {
  image: '이미지형',
  video: '동영상형',
  both: '이미지형 + 동영상형',
};

export const CREATIVE_AUDIO_MODE_LABELS: Record<CreativeAudioMode, string> = {
  bgm_narration: 'BGM + 멘트',
  bgm_only: 'BGM 중심',
  narration_only: '멘트 중심',
};

export const CREATIVE_ASSET_LABELS: Record<CreativeAssetKind, string> = {
  store: '매장 외부/간판',
  food: '음식/메뉴',
  interior: '내부 공간',
  staff: '원장/강사/트레이너',
  product: '제품/시술 컷',
  before_after: '전후 비교/후기',
  none: '보유 사진 없음',
};

const PROFILE_PRESETS: Record<string, CreativeProfilePreset> = {
  restaurant: {
    label: '외식/식음료',
    conceptTitle: '15초 식욕 자극형 소재 패키지',
    conceptSummary: '대표 메뉴와 매장 분위기를 빠르게 보여주고 위치/혜택 문구로 방문을 유도하는 구조입니다.',
    keywords: ['대표메뉴', '점심/저녁', '방문유도', '배달/예약'],
    imageVisuals: [
      '시그니처 메뉴를 먹음직스럽게 클로즈업한 메인 컷',
      '매장 외관 또는 내부 좌석을 넓게 보여주는 분위기 컷',
      '행사/할인/위치 안내를 텍스트로 정리한 CTA 컷',
    ],
    fallbackCopies: ['시그니처 메뉴 집중 노출', '방문하고 싶은 매장 분위기 강조', '혜택과 위치를 넣어 즉시 방문 유도'],
    videoStyle: '유튜브 광고형 빠른 컷 편집 + 텍스트 모션',
    videoVisuals: [
      '메뉴 조리 또는 대표 메뉴 노출',
      '매장 분위기와 피크 시간대 활기 전달',
      '혜택/예약/배달 CTA 강조',
    ],
    bgm: '경쾌한 어쿠스틱 또는 라이트 팝 무료음원',
    narration: [
      '오늘 메뉴 고민된다면, 눈에 띄는 대표 메뉴로 먼저 시선을 잡습니다.',
      '매장 분위기와 접근성을 함께 보여주고 방문 이유를 만듭니다.',
      '마지막 5초는 할인, 예약, 위치 문구로 행동을 유도합니다.',
    ],
    requiredAssets: ['대표 메뉴 또는 시그니처 상품 사진', '매장 외부/내부 사진', '이벤트 문구 또는 가격 정보'],
  },
  hospital: {
    label: '병원/클리닉',
    conceptTitle: '15초 신뢰 형성형 소재 패키지',
    conceptSummary: '전문성, 청결감, 진료 혜택을 차례로 보여주며 불안을 줄이고 상담 문의를 유도하는 구조입니다.',
    keywords: ['전문성', '청결감', '상담유도', '접근성'],
    imageVisuals: [
      '의료진 또는 상담 장면을 안정감 있게 보여주는 메인 컷',
      '대기실/장비/시술실 등 청결한 시설 컷',
      '주요 진료 항목과 위치/예약 안내를 담은 CTA 컷',
    ],
    fallbackCopies: ['전문 의료진과 진료 포인트 강조', '쾌적한 시설과 상담 환경 전달', '상담 예약 및 위치 안내로 문의 유도'],
    videoStyle: '유튜브 광고형 인터뷰/시설 컷 기반 신뢰형 편집',
    videoVisuals: [
      '전문의 또는 상담 장면 노출',
      '시설과 장비, 진료 환경 소개',
      '진료 항목과 예약 CTA 제시',
    ],
    bgm: '차분한 피아노 또는 미니멀 코퍼레이트 무료음원',
    narration: [
      '전문성과 신뢰를 먼저 전달하고 불안 요소를 줄이는 편집이 유효합니다.',
      '시설과 상담 장면을 함께 써서 안심 포인트를 분명히 보여줍니다.',
      '마지막에는 진료 과목과 예약 방법을 간단히 정리합니다.',
    ],
    requiredAssets: ['의료진/상담 장면 사진', '시설 또는 장비 사진', '진료 과목/상담 연락처'],
  },
  academy: {
    label: '학원/교육',
    conceptTitle: '15초 성과 강조형 소재 패키지',
    conceptSummary: '수업 분위기, 강사진 신뢰, 성과 메시지를 짧게 연결해 상담 신청을 유도하는 구조입니다.',
    keywords: ['강사진', '수업분위기', '성과', '상담신청'],
    imageVisuals: [
      '강사/수업 장면을 보여주는 메인 컷',
      '학생 반응 또는 학습 환경을 보여주는 신뢰 컷',
      '모집 과정, 성과, 상담 안내를 정리한 CTA 컷',
    ],
    fallbackCopies: ['강사진과 커리큘럼 강점 강조', '학습 분위기와 학원 신뢰도 전달', '상담 신청 또는 이벤트 안내'],
    videoStyle: '유튜브 광고형 인터뷰 + 자막형 퍼포먼스 편집',
    videoVisuals: [
      '수업 장면 또는 강의 컷',
      '학습 몰입감과 후기/성과 장면',
      '모집 일정과 상담 CTA 제시',
    ],
    bgm: '밝고 경쾌한 코퍼레이트 무료음원',
    narration: [
      '첫 장면에서 강사진이나 수업 장면으로 신뢰를 확보합니다.',
      '학습 분위기와 성과 포인트를 짧게 연결해 설득력을 높입니다.',
      '마지막 컷은 모집 일정이나 상담 혜택으로 마무리합니다.',
    ],
    requiredAssets: ['강사 또는 수업 사진', '학원 내부/학생 활동 사진', '성과 수치 또는 모집 정보'],
  },
  gym: {
    label: '헬스/피트니스',
    conceptTitle: '15초 변화 체감형 소재 패키지',
    conceptSummary: '몸의 변화 기대감과 시설 경쟁력을 동시에 전달해 체험 등록을 유도하는 구조입니다.',
    keywords: ['체형변화', 'PT전문성', '시설경쟁력', '체험등록'],
    imageVisuals: [
      '트레이너 또는 운동 장면을 역동적으로 보여주는 메인 컷',
      '기구/시설/샤워실 등 차별화 포인트 컷',
      '체험권/이벤트/위치 정보를 담은 CTA 컷',
    ],
    fallbackCopies: ['운동 동기와 목표를 자극하는 메인 메시지', '시설과 전문 트레이닝 강점 전달', '체험권 또는 등록 혜택 안내'],
    videoStyle: '유튜브 광고형 템포감 있는 운동 컷 편집',
    videoVisuals: [
      '운동 장면 또는 PT 지도 컷',
      '시설과 프로그램 소개',
      '체험권/프로모션 CTA 제시',
    ],
    bgm: '에너지 있는 일렉트로닉 또는 스포츠 계열 무료음원',
    narration: [
      '첫 5초 안에 운동 의지를 자극하는 컷이 필요합니다.',
      '시설과 트레이닝 장면으로 전문성을 보여주면 등록 전환에 유리합니다.',
      '마지막에는 체험권, 프로모션, 위치를 강하게 제시합니다.',
    ],
    requiredAssets: ['운동 장면 또는 트레이너 사진', '시설/기구 사진', '체험권/프로모션 문구'],
  },
  beauty: {
    label: '뷰티/살롱',
    conceptTitle: '15초 전후 체감형 소재 패키지',
    conceptSummary: '시술 결과와 공간 무드를 함께 보여주며 예약 욕구를 만드는 구조입니다.',
    keywords: ['전후비교', '분위기', '예약유도', '혜택'],
    imageVisuals: [
      '시술 결과 또는 스타일링 컷을 메인으로 제시',
      '살롱/클리닉 공간과 서비스 장면 컷',
      '예약 혜택, 위치, 운영시간 CTA 컷',
    ],
    fallbackCopies: ['결과가 보이는 전후 차이 강조', '프리미엄 공간과 서비스 경험 전달', '예약 혜택과 위치 안내'],
    videoStyle: '유튜브 광고형 비포애프터 중심 편집',
    videoVisuals: [
      '시술 결과 또는 스타일 변화 장면',
      '서비스 과정과 공간 분위기',
      '예약 혜택과 CTA',
    ],
    bgm: '세련된 로파이 또는 미니멀 팝 무료음원',
    narration: [
      '결과가 보이는 장면을 초반에 배치하면 집중도가 높습니다.',
      '공간과 서비스 컷으로 프리미엄 이미지를 강화합니다.',
      '마지막에는 예약 혜택과 위치를 명확히 제시합니다.',
    ],
    requiredAssets: ['전후 사진 또는 스타일링 사진', '내부 공간/시술 장면 사진', '예약 혜택 정보'],
  },
  generic: {
    label: '로컬 비즈니스',
    conceptTitle: '15초 인지도 확장형 소재 패키지',
    conceptSummary: '브랜드 핵심 장점, 현장 분위기, 행동 유도 문구를 순서대로 배치하는 기본 구조입니다.',
    keywords: ['브랜드강점', '현장분위기', '혜택안내', '방문유도'],
    imageVisuals: [
      '브랜드를 대표하는 메인 비주얼 컷',
      '공간, 서비스, 제품 경쟁력을 보여주는 보조 컷',
      '혜택, 위치, 문의처를 담은 CTA 컷',
    ],
    fallbackCopies: ['브랜드 핵심 장점을 한 줄로 제시', '서비스 또는 공간 차별점을 보여주기', '혜택과 위치를 넣어 행동 유도'],
    videoStyle: '유튜브 광고형 브랜드 소개 편집',
    videoVisuals: [
      '대표 서비스 또는 메인 비주얼 제시',
      '브랜드 경험과 차별점 설명',
      '혜택/위치/문의 CTA',
    ],
    bgm: '밝은 코퍼레이트 또는 트렌디한 무료음원',
    narration: [
      '핵심 장점을 1초 안에 이해되게 보여주는 구성이 중요합니다.',
      '중간 구간에는 공간과 서비스 강점을 짧고 명확하게 배치합니다.',
      '마지막에는 위치와 문의 행동을 바로 유도합니다.',
    ],
    requiredAssets: ['대표 서비스 또는 제품 사진', '공간/현장 사진', '혜택/문의 정보'],
  },
};

const INDUSTRY_KEYWORDS: Array<{ key: keyof typeof PROFILE_PRESETS; keywords: string[] }> = [
  { key: 'restaurant', keywords: ['식당', '음식', '한식', '중식', '일식', '카페', '주점', '레스토랑', '분식', '치킨', '피자', '베이커리'] },
  { key: 'hospital', keywords: ['병원', '의원', '치과', '한의원', '산부인과', '피부과', '정형외과', '안과', '클리닉', '검진'] },
  { key: 'academy', keywords: ['학원', '교육', '입시', '영어', '수학', '논술', '유치원', '교습소', '스터디'] },
  { key: 'gym', keywords: ['헬스', '피트니스', '필라테스', 'PT', '요가', '크로스핏', '짐', '체육관'] },
  { key: 'beauty', keywords: ['미용', '헤어', '네일', '피부', '뷰티', '에스테틱', '왁싱', '메이크업'] },
];

function detectProfile(industry: string): CreativeProfilePreset {
  const normalized = industry.toLowerCase().replace(/\s+/g, '');
  for (const entry of INDUSTRY_KEYWORDS) {
    if (entry.keywords.some(keyword => normalized.includes(keyword.toLowerCase().replace(/\s+/g, '')))) {
      return PROFILE_PRESETS[entry.key];
    }
  }
  return PROFILE_PRESETS.generic;
}

function splitMessage(message: string, fallback: string[]): string[] {
  const chunks = message
    .split(/\n|\/|·|•|,|\||;/)
    .map(part => part.trim())
    .filter(Boolean);

  if (chunks.length >= 2) return chunks;
  if (message.trim()) return [message.trim(), ...fallback.slice(1)];
  return fallback;
}

function normalizeAssetKinds(assetKinds: CreativeAssetKind[] | undefined): CreativeAssetKind[] {
  if (!assetKinds || assetKinds.length === 0) return ['none'];
  if (assetKinds.includes('none')) return ['none'];
  return [...new Set(assetKinds)];
}

function resolveSceneCount(parts: string[], assetKinds: CreativeAssetKind[]): 2 | 3 {
  if (assetKinds.includes('none')) return 2;
  if (parts.length >= 3 || assetKinds.length >= 2) return 3;
  return 2;
}

function buildSourceStrategy(assetKinds: CreativeAssetKind[]): string {
  if (assetKinds.includes('none')) {
    return '업종에 맞는 AI 이미지 초안을 저비용으로 생성한 뒤 업스케일해 2~3컷 구성으로 편집';
  }
  return `${assetKinds.map(kind => CREATIVE_ASSET_LABELS[kind]).join(', ')} 중심으로 편집하고 필요한 컷은 AI 보조 이미지로 보강`;
}

function buildImageScenes(
  preset: CreativeProfilePreset,
  parts: string[],
  assetKinds: CreativeAssetKind[],
  sceneCount: 2 | 3,
): CreativeStoryboardScene[] {
  const durationSec = sceneCount === 3 ? 5 : 7.5;
  return preset.imageVisuals.slice(0, sceneCount).map((visual, index) => ({
    title: `${index + 1}컷`,
    duration_sec: durationSec,
    visual: `${visual}${assetKinds.includes('none') ? ' (AI 생성 가능)' : ''}`,
    copy: parts[index] || preset.fallbackCopies[index] || preset.fallbackCopies[preset.fallbackCopies.length - 1],
  }));
}

function buildVideoBeats(
  preset: CreativeProfilePreset,
  parts: string[],
): CreativeVideoBeat[] {
  const timeRanges = ['0-5초', '5-10초', '10-15초'];
  return preset.videoVisuals.map((visual, index) => ({
    time_range: timeRanges[index] || `${index * 5}-${index * 5 + 5}초`,
    visual,
    copy: parts[index] || preset.fallbackCopies[index] || preset.fallbackCopies[preset.fallbackCopies.length - 1],
  }));
}

function buildRequiredAssets(
  preset: CreativeProfilePreset,
  assetKinds: CreativeAssetKind[],
  message: string,
): string[] {
  const assets = [...preset.requiredAssets];
  if (assetKinds.includes('none')) {
    assets.unshift('광고주 로고 또는 상호명 텍스트 자료');
  } else {
    assets.unshift(`보유 사진 소스: ${assetKinds.map(kind => CREATIVE_ASSET_LABELS[kind]).join(', ')}`);
  }
  if (message.trim()) {
    assets.push(`삽입 희망 홍보문구: ${message.trim()}`);
  }
  return assets;
}

function buildNarrationLines(
  preset: CreativeProfilePreset,
  parts: string[],
  advertiserName: string,
): string[] {
  const introBrand = advertiserName.trim() ? `${advertiserName.trim()}의 핵심 강점을 첫 장면에 노출합니다.` : preset.narration[0];
  return [
    introBrand,
    parts[1] ? `중간 구간은 "${parts[1]}" 메시지를 자막과 함께 반복 노출합니다.` : preset.narration[1],
    parts[2] ? `마지막 컷은 "${parts[2]}" 문구와 위치/문의 CTA로 마감합니다.` : preset.narration[2],
  ];
}

function buildCanvaMasterPrompt(
  advertiserName: string,
  campaignName: string,
  preset: CreativeProfilePreset,
  imageScenes: CreativeStoryboardScene[],
  videoBeats: CreativeVideoBeat[],
  audioMode: CreativeAudioMode,
  message: string,
): string {
  const safeAdvertiser = advertiserName.trim() || '광고주';
  const safeCampaign = campaignName.trim() || '15초 광고 캠페인';
  const safeMessage = message.trim() || preset.fallbackCopies.join(' / ');

  return [
    `${safeAdvertiser}의 ${safeCampaign}용 세로형 엘리베이터 광고를 Canva에서 제작하려고 합니다.`,
    `업종은 ${preset.label}이며 총 길이는 15초, 규격은 1080x1650 세로형입니다.`,
    `톤앤매너는 ${preset.keywords.join(', ')} 중심의 프리미엄 상업 광고 느낌으로 구성해주세요.`,
    `이미지형 구성: ${imageScenes.map(scene => `${scene.title} ${scene.duration_sec}초 / ${scene.visual} / 문구 ${scene.copy}`).join(' | ')}`,
    `동영상형 구성: ${videoBeats.map(beat => `${beat.time_range} / ${beat.visual} / 문구 ${beat.copy}`).join(' | ')}`,
    `핵심 메시지: ${safeMessage}`,
    `오디오는 ${CREATIVE_AUDIO_MODE_LABELS[audioMode]} 기준으로 잡고, BGM과 멘트가 후편집에 들어가기 좋게 텍스트 안전 여백을 확보해주세요.`,
    '결과물은 광고 문구를 후편집으로 얹기 좋도록 과한 내장 자막 없이, CTA를 마지막 컷에 넣기 좋은 구도로 만들어주세요.',
  ].join('\n');
}

function buildCanvaImageScenePrompts(
  advertiserName: string,
  preset: CreativeProfilePreset,
  imageScenes: CreativeStoryboardScene[],
): string[] {
  const safeAdvertiser = advertiserName.trim() || '광고주';
  return imageScenes.map((scene, index) => [
    `${safeAdvertiser} ${preset.label} 광고용 ${index + 1}컷 이미지 생성`,
    `세로형 1080x1650, 상업 광고 사진 느낌`,
    `비주얼: ${scene.visual}`,
    `전달 메시지: ${scene.copy}`,
    `톤앤매너: ${preset.keywords.join(', ')}`,
    '텍스트를 이미지에 직접 많이 넣지 말고, 후편집 자막용 여백을 확보해주세요.',
  ].join('\n'));
}

function buildCanvaVideoPrompt(
  advertiserName: string,
  preset: CreativeProfilePreset,
  videoBeats: CreativeVideoBeat[],
  audioMode: CreativeAudioMode,
): string {
  const safeAdvertiser = advertiserName.trim() || '광고주';
  return [
    `${safeAdvertiser} ${preset.label} 광고용 15초 세로형 영상 생성`,
    `규격: 1080x1650, 총 15초`,
    `스타일: ${preset.videoStyle}`,
    `구간 구성: ${videoBeats.map(beat => `${beat.time_range} ${beat.visual} / ${beat.copy}`).join(' | ')}`,
    `톤앤매너: ${preset.keywords.join(', ')}`,
    `오디오 방향: ${CREATIVE_AUDIO_MODE_LABELS[audioMode]} / ${preset.bgm}`,
    '마지막 장면은 위치, 문의, 혜택 CTA를 넣기 좋은 안정적인 구도로 끝나야 합니다.',
  ].join('\n');
}

function buildCanvaCopyPrompt(
  advertiserName: string,
  campaignName: string,
  preset: CreativeProfilePreset,
  parts: string[],
  audioMode: CreativeAudioMode,
): string {
  const safeAdvertiser = advertiserName.trim() || '광고주';
  const safeCampaign = campaignName.trim() || '15초 광고';
  return [
    `${safeAdvertiser}의 ${safeCampaign}용 Canva Magic Write 프롬프트`,
    `업종: ${preset.label}`,
    `목표: 엘리베이터 광고 15초용 한글 카피 세트`,
    `필요 산출물: 후킹 헤드라인 3개, 컷별 자막 2~3개, 마지막 CTA 3개, 15초 내레이션 1종`,
    `반드시 반영할 메시지: ${parts.join(' / ')}`,
    `오디오 방향: ${CREATIVE_AUDIO_MODE_LABELS[audioMode]}`,
    '문장은 짧고 선명하게, 한 컷당 한 메시지만 들어가게 작성해주세요.',
  ].join('\n');
}

function buildInternalApiPathGuide(
  preferredFormat: CreativeFormat,
  audioMode: CreativeAudioMode,
  assetKinds: CreativeAssetKind[],
): CreativePlan['delivery_paths']['internal_api'] {
  return {
    summary: '브리프를 JSON으로 보내면 기획안과 Canva 프롬프트를 돌려주는 API를 제공하고, 실제 결과물 생성 API도 별도로 유지합니다.',
    endpoint: '/api/creative/plan',
    method: 'POST',
    companion_endpoints: ['/api/creative/produce', '/api/creative/status'],
    required_fields: [
      'advertiser_name',
      'advertiser_industry',
      'campaign_name',
      'creative_message',
      'creative_format',
      'creative_audio_mode',
      `creative_asset_kinds=${assetKinds.join(',')}`,
      'notes (optional)',
    ],
    outputs: [
      `기획 형태: ${CREATIVE_FORMAT_LABELS[preferredFormat]}`,
      `오디오 구성: ${CREATIVE_AUDIO_MODE_LABELS[audioMode]}`,
      'creativePlan JSON: storyboard / audio / checklist / delivery_paths.canva',
      '실제 생성은 /api/creative/produce + /api/creative/status 조합으로 이어서 사용',
    ],
  };
}

export function buildCreativePlan(brief: CreativeBrief): CreativePlan {
  const advertiserIndustry = String(brief.advertiser_industry || '');
  const advertiserName = String(brief.advertiser_name || '');
  const preferredFormat = (brief.preferred_format || 'both') as CreativeFormat;
  const audioMode = (brief.audio_mode || 'bgm_narration') as CreativeAudioMode;
  const assetKinds = normalizeAssetKinds(brief.asset_kinds);
  const preset = detectProfile(advertiserIndustry);
  const messageParts = splitMessage(String(brief.message || ''), preset.fallbackCopies);
  const sceneCount = resolveSceneCount(messageParts, assetKinds);

  const imageEnabled = preferredFormat === 'image' || preferredFormat === 'both';
  const videoEnabled = preferredFormat === 'video' || preferredFormat === 'both';
  const imageScenes = buildImageScenes(preset, messageParts, assetKinds, sceneCount);
  const videoBeats = buildVideoBeats(preset, messageParts);
  const narrationLines = buildNarrationLines(preset, messageParts, advertiserName);

  const formatSummary = preferredFormat === 'both'
    ? '이미지형 15초 편집안 + 유튜브 광고형 영상안 동시 제안'
    : `${CREATIVE_FORMAT_LABELS[preferredFormat]} 중심 15초 제안`;

  return {
    profile_label: preset.label,
    concept_title: preset.conceptTitle,
    concept_summary: `${preset.conceptSummary} ${formatSummary}. 샘플 기준 제작 규격은 세로형 1080x1650(필요 시 2160x3300) / 총 15초입니다.`,
    recommended_keywords: preset.keywords,
    image_package: {
      enabled: imageEnabled,
      composition: sceneCount === 3 ? '5초 x 3컷 = 총 15초' : '7.5초 x 2컷 = 총 15초',
      recommendation: imageEnabled
        ? `이미지형은 ${sceneCount}컷 구조로 편집하고 컷마다 핵심 문구를 1개씩 배치합니다.`
        : '이미지형 제안은 비활성화됨',
      source_strategy: buildSourceStrategy(assetKinds),
      scenes: imageScenes,
    },
    video_package: {
      enabled: videoEnabled,
      style: preset.videoStyle,
      recommendation: videoEnabled
        ? '동영상형은 초반 후킹 5초, 차별점 5초, CTA 5초 구조로 편집합니다.'
        : '동영상형 제안은 비활성화됨',
      beats: videoBeats,
    },
    audio: {
      mode: audioMode,
      mode_label: CREATIVE_AUDIO_MODE_LABELS[audioMode],
      bgm: preset.bgm,
      narration_lines: narrationLines,
    },
    required_assets: buildRequiredAssets(preset, assetKinds, String(brief.message || '')),
    production_checklist: [
      `소재 형태: ${CREATIVE_FORMAT_LABELS[preferredFormat]}`,
      `오디오 구성: ${CREATIVE_AUDIO_MODE_LABELS[audioMode]} (${audioMode === 'bgm_only' ? '무료음원 필수' : audioMode === 'narration_only' ? '멘트 중심, 배경음 최소화' : '무료음원 + 멘트 동시 구성'})`,
      '샘플 기준 세로형 1080x1650(또는 2160x3300) / 총 15초 규격으로 편집',
      '마지막 컷에 위치, 문의, 프로모션 CTA 고정 배치',
      '광고주 전달 사진이 부족하면 AI 생성 컷으로 보강',
      brief.notes?.trim() ? `추가 메모 반영: ${brief.notes.trim()}` : '추가 메모는 최종 편집 시 반영',
    ],
    delivery_paths: {
      canva: {
        summary: 'Canva에서 바로 붙여넣어 이미지/영상 초안을 만들고, 이후 자막과 CTA만 후편집하는 셀프서빙 경로입니다.',
        steps: [
          'Canva Magic Media 또는 영상 생성 도구에 마스터 프롬프트를 먼저 넣습니다.',
          '컷별 이미지 프롬프트로 2~3개의 정지컷 또는 보조 장면을 생성합니다.',
          'Magic Write 프롬프트로 자막/헤드라인/CTA 문구를 생성하고 편집기에 얹습니다.',
          `최종 규격은 1080x1650 세로형, 15초, ${CREATIVE_AUDIO_MODE_LABELS[audioMode]} 기준으로 맞춥니다.`,
        ],
        master_prompt: buildCanvaMasterPrompt(
          advertiserName,
          String(brief.campaign_name || ''),
          preset,
          imageScenes,
          videoBeats,
          audioMode,
          String(brief.message || ''),
        ),
        image_scene_prompts: buildCanvaImageScenePrompts(advertiserName, preset, imageScenes),
        video_prompt: buildCanvaVideoPrompt(advertiserName, preset, videoBeats, audioMode),
        copy_prompt: buildCanvaCopyPrompt(
          advertiserName,
          String(brief.campaign_name || ''),
          preset,
          messageParts,
          audioMode,
        ),
      },
      internal_api: buildInternalApiPathGuide(preferredFormat, audioMode, assetKinds),
    },
  };
}
