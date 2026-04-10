import { useState, useCallback, useEffect } from 'react';
import { buildCreativePlan, CREATIVE_ASSET_LABELS } from '@/lib/creativePlan';
import type { CreativeAssetKind, CreativeAudioMode, CreativeFormat } from '@/lib/types';
import type { CreativeRenderManifest } from '@/lib/creativeStudio';

type StudioView = 'overview' | 'prompts' | 'api' | 'results';
type WorkspaceMode = 'proposal' | 'studio' | 'mining';

const STUDIO_INDUSTRY_SUGGESTIONS = [
  '식당', '카페', '병원', '치과', '학원', '헬스장', '필라테스', '뷰티',
  '헤어샵', '네일샵', '부동산', '쇼핑몰', '가전', '마트', '전시장', '이벤트',
];

export function useStudioState(
  workspaceMode: WorkspaceMode,
  setWorkspaceMode: (m: WorkspaceMode) => void,
  industries: string[],
) {
  const [studioAdvertiserName, setStudioAdvertiserName] = useState('');
  const [studioCampaignName, setStudioCampaignName] = useState('');
  const [studioAdvertiserIndustry, setStudioAdvertiserIndustry] = useState('');
  const [studioNotes, setStudioNotes] = useState('');
  const [studioCreativeMessage, setStudioCreativeMessage] = useState('');
  const [studioCreativeFormat, setStudioCreativeFormat] = useState<CreativeFormat>('both');
  const [studioCreativeAudioMode, setStudioCreativeAudioMode] = useState<CreativeAudioMode>('bgm_narration');
  const [studioCreativeAssetKinds, setStudioCreativeAssetKinds] = useState<CreativeAssetKind[]>(['none']);
  const [creativeSourceFiles, setCreativeSourceFiles] = useState<File[]>([]);
  const [creativeBgmFile, setCreativeBgmFile] = useState<File | null>(null);
  const [studioOpenAiKey, setStudioOpenAiKey] = useState('');
  const [isProducingCreative, setIsProducingCreative] = useState(false);
  const [creativeRender, setCreativeRender] = useState<CreativeRenderManifest | null>(null);
  const [creativeHistory, setCreativeHistory] = useState<CreativeRenderManifest[]>([]);
  const [isLoadingCreativeHistory, setIsLoadingCreativeHistory] = useState(false);
  const [creativeHistoryError, setCreativeHistoryError] = useState('');
  const [creativeRenderError, setCreativeRenderError] = useState('');
  const [copiedCreativeKey, setCopiedCreativeKey] = useState('');
  const [studioView, setStudioView] = useState<StudioView>('overview');
  const [showStudioAdvanced, setShowStudioAdvanced] = useState(false);
  const [studioFormSeed, setStudioFormSeed] = useState(() => Date.now());

  const creativeApiBase = (process.env.NEXT_PUBLIC_CREATIVE_API_BASE || '').trim().replace(/\/$/, '');
  const creativeProduceEndpoint = creativeApiBase ? `${creativeApiBase}/api/creative/produce` : '/api/creative/produce';
  const creativeStatusEndpoint = creativeApiBase ? `${creativeApiBase}/api/creative/status` : '/api/creative/status';
  const creativeHistoryEndpoint = creativeApiBase ? `${creativeApiBase}/api/creative/history` : '/api/creative/history';

  const resetStudioForm = useCallback(() => {
    setStudioAdvertiserName('');
    setStudioCampaignName('');
    setStudioAdvertiserIndustry('');
    setStudioCreativeMessage('');
    setStudioNotes('');
    setStudioCreativeFormat('both');
    setStudioCreativeAudioMode('bgm_narration');
    setStudioCreativeAssetKinds(['none']);
    setCreativeSourceFiles([]);
    setCreativeBgmFile(null);
    setStudioOpenAiKey('');
    setCreativeRender(null);
    setCreativeRenderError('');
    setCopiedCreativeKey('');
    setStudioView('overview');
    setShowStudioAdvanced(false);
    setStudioFormSeed(Date.now());
  }, []);

  const toggleStudioCreativeAsset = useCallback((asset: CreativeAssetKind) => {
    setStudioCreativeAssetKinds(prev => {
      if (asset === 'none') {
        return prev.length === 1 && prev.includes('none') ? [] : ['none'];
      }
      const withoutNone = prev.filter(kind => kind !== 'none');
      if (withoutNone.includes(asset)) {
        const next = withoutNone.filter(kind => kind !== asset);
        return next.length > 0 ? next : ['none'];
      }
      return [...withoutNone, asset];
    });
  }, []);

  const createCreativeHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (studioOpenAiKey.trim()) {
      headers['x-openai-api-key'] = studioOpenAiKey.trim();
    }
    return headers;
  }, [studioOpenAiKey]);

  const clearCreativeRenderError = useCallback(() => {
    setCreativeRenderError('');
  }, []);

  const upsertCreativeHistoryItem = useCallback((item: CreativeRenderManifest) => {
    setCreativeHistory(prev => {
      const next = [item, ...prev.filter(existing => existing.id !== item.id)];
      next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return next.slice(0, 12);
    });
  }, []);

  const loadCreativeHistory = useCallback(async () => {
    setIsLoadingCreativeHistory(true);
    setCreativeHistoryError('');
    try {
      const resp = await fetch(`${creativeHistoryEndpoint}?limit=12`, { headers: createCreativeHeaders() });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || '생성 이력 조회 실패');
      setCreativeHistory(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setCreativeHistoryError(String(e));
    } finally {
      setIsLoadingCreativeHistory(false);
    }
  }, [createCreativeHeaders, creativeHistoryEndpoint]);

  const refreshCreativeRender = useCallback(async (id: string, refresh = true) => {
    const resp = await fetch(
      `${creativeStatusEndpoint}?id=${encodeURIComponent(id)}&refresh=${refresh ? 'true' : 'false'}`,
      { headers: createCreativeHeaders() },
    );
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '소재 상태 조회 실패');
    setCreativeRender(data);
    upsertCreativeHistoryItem(data);
    return data as CreativeRenderManifest;
  }, [createCreativeHeaders, creativeStatusEndpoint, upsertCreativeHistoryItem]);

  const applyCreativeHistoryItem = useCallback((item: CreativeRenderManifest) => {
    const brief = item.brief;
    setWorkspaceMode('studio');
    setStudioAdvertiserName(brief.advertiser_name || '');
    setStudioAdvertiserIndustry(brief.advertiser_industry || '');
    setStudioCampaignName(brief.campaign_name || '');
    setStudioCreativeMessage(brief.message || '');
    setStudioNotes(brief.notes || '');
    setStudioCreativeFormat(brief.preferred_format || 'both');
    setStudioCreativeAudioMode(brief.audio_mode || 'bgm_narration');
    setStudioCreativeAssetKinds(brief.asset_kinds && brief.asset_kinds.length > 0 ? brief.asset_kinds : ['none']);
    setCreativeSourceFiles([]);
    setCreativeBgmFile(null);
    setCreativeRender(item);
    setCreativeRenderError('');
    setStudioView('results');
    setShowStudioAdvanced(Boolean(brief.campaign_name || brief.notes));
  }, [setWorkspaceMode]);

  const handleProduceCreative = useCallback(async () => {
    setIsProducingCreative(true);
    setCreativeRenderError('');
    try {
      const form = new FormData();
      form.append('advertiser_name', studioAdvertiserName);
      form.append('advertiser_industry', studioAdvertiserIndustry);
      form.append('campaign_name', studioCampaignName);
      form.append('creative_message', studioCreativeMessage);
      form.append('creative_format', studioCreativeFormat);
      form.append('creative_audio_mode', studioCreativeAudioMode);
      form.append('creative_asset_kinds', studioCreativeAssetKinds.join(','));
      form.append('notes', studioNotes);
      creativeSourceFiles.forEach(file => form.append('source_files', file));
      if (creativeBgmFile) form.append('bgm_file', creativeBgmFile);

      const resp = await fetch(creativeProduceEndpoint, {
        method: 'POST',
        headers: createCreativeHeaders(),
        body: form,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || '소재 제작 실패');
      setCreativeRender(data);
      upsertCreativeHistoryItem(data);
      setWorkspaceMode('studio');
      setStudioView('results');
      void loadCreativeHistory();
    } catch (e) {
      setCreativeRenderError(String(e));
    } finally {
      setIsProducingCreative(false);
    }
  }, [
    studioAdvertiserName, studioAdvertiserIndustry, studioCampaignName, studioCreativeMessage,
    studioCreativeFormat, studioCreativeAudioMode, studioCreativeAssetKinds, studioNotes,
    creativeSourceFiles, creativeBgmFile, createCreativeHeaders, creativeProduceEndpoint,
    loadCreativeHistory, upsertCreativeHistoryItem, setWorkspaceMode,
  ]);

  const copyCreativeText = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCreativeKey(key);
      window.setTimeout(() => {
        setCopiedCreativeKey(current => current === key ? '' : current);
      }, 1800);
    } catch (e) {
      setCreativeRenderError(`복사 실패: ${e}`);
    }
  }, []);

  const hasPendingCreativeVideo = !!creativeRender?.video_jobs.some(
    job => job.status === 'queued' || job.status === 'in_progress',
  );

  useEffect(() => {
    if (!creativeRender?.id || !hasPendingCreativeVideo) return;
    const timer = window.setInterval(() => {
      void refreshCreativeRender(creativeRender.id, true).catch(() => {});
    }, 12000);
    return () => window.clearInterval(timer);
  }, [creativeRender?.id, hasPendingCreativeVideo, refreshCreativeRender]);

  useEffect(() => {
    if (workspaceMode !== 'studio' || studioView !== 'results') return;
    void loadCreativeHistory();
  }, [workspaceMode, studioView, loadCreativeHistory]);

  // Derived values
  const studioIndustryOptions = [...new Set([...STUDIO_INDUSTRY_SUGGESTIONS, ...industries])];
  const selectedCreativeAssets = studioCreativeAssetKinds.length > 0
    ? studioCreativeAssetKinds.map(kind => CREATIVE_ASSET_LABELS[kind])
    : ['미지정'];
  const studioStatusLabel = creativeRender
    ? creativeRender.status === 'completed' ? '완료'
    : creativeRender.status === 'failed' ? '실패'
    : creativeRender.status === 'partial' ? '부분 완료'
    : '생성 중'
    : '준비 중';
  const studioSteps = [
    {
      key: 'setup',
      title: '기본 정보',
      description: studioAdvertiserName || studioAdvertiserIndustry || studioCreativeMessage
        ? '광고주와 메시지가 입력되었습니다.'
        : '광고주명, 업종, 핵심 문구를 입력하세요.',
      done: Boolean(studioAdvertiserName || studioAdvertiserIndustry || studioCreativeMessage),
    },
    {
      key: 'assets',
      title: '소스 업로드',
      description: creativeSourceFiles.length > 0
        ? `${creativeSourceFiles.length}개 소스가 준비되었습니다.`
        : '사진 2~3장이나 원본 영상을 올리세요.',
      done: creativeSourceFiles.length > 0,
    },
    {
      key: 'render',
      title: '미리보기 생성',
      description: creativeRender
        ? `현재 상태: ${studioStatusLabel}`
        : '제작 버튼으로 내부 확인용 결과를 생성합니다.',
      done: Boolean(creativeRender),
    },
  ];
  const studioPlan = buildCreativePlan({
    advertiser_name: studioAdvertiserName,
    advertiser_industry: studioAdvertiserIndustry,
    campaign_name: studioCampaignName,
    message: studioCreativeMessage,
    notes: studioNotes,
    preferred_format: studioCreativeFormat,
    audio_mode: studioCreativeAudioMode,
    asset_kinds: studioCreativeAssetKinds,
  });
  const studioPlanApiPayload = JSON.stringify({
    advertiser_name: studioAdvertiserName,
    advertiser_industry: studioAdvertiserIndustry,
    campaign_name: studioCampaignName,
    creative_message: studioCreativeMessage,
    creative_format: studioCreativeFormat,
    creative_audio_mode: studioCreativeAudioMode,
    creative_asset_kinds: studioCreativeAssetKinds,
    notes: studioNotes,
  }, null, 2);

  return {
    studioAdvertiserName, setStudioAdvertiserName,
    studioAdvertiserIndustry, setStudioAdvertiserIndustry,
    studioCampaignName, setStudioCampaignName,
    studioNotes, setStudioNotes,
    studioCreativeMessage, setStudioCreativeMessage,
    studioCreativeFormat, setStudioCreativeFormat,
    studioCreativeAudioMode, setStudioCreativeAudioMode,
    studioCreativeAssetKinds,
    creativeSourceFiles, setCreativeSourceFiles,
    creativeBgmFile, setCreativeBgmFile,
    studioOpenAiKey, setStudioOpenAiKey,
    isProducingCreative,
    creativeRender, setCreativeRender,
    creativeHistory,
    isLoadingCreativeHistory,
    creativeHistoryError,
    creativeRenderError,
    copiedCreativeKey,
    studioView, setStudioView,
    showStudioAdvanced, setShowStudioAdvanced,
    studioFormSeed,
    clearCreativeRenderError,
    creativeProduceEndpoint,
    creativeStatusEndpoint,
    resetStudioForm,
    toggleStudioCreativeAsset,
    loadCreativeHistory,
    refreshCreativeRender,
    applyCreativeHistoryItem,
    handleProduceCreative,
    copyCreativeText,
    studioIndustryOptions,
    selectedCreativeAssets,
    studioStatusLabel,
    studioSteps,
    studioPlan,
    studioPlanApiPayload,
  };
}
