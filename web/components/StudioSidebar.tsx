'use client';

import {
  CREATIVE_ASSET_LABELS,
  CREATIVE_AUDIO_MODE_LABELS,
  CREATIVE_FORMAT_LABELS,
} from '@/lib/creativePlan';
import type { CreativeAssetKind, CreativeAudioMode, CreativeFormat } from '@/lib/types';

const FORMAT_OPTIONS: CreativeFormat[] = ['both', 'image', 'video'];
const AUDIO_OPTIONS: CreativeAudioMode[] = ['bgm_narration', 'bgm_only', 'narration_only'];
const ASSET_OPTIONS: CreativeAssetKind[] = ['store', 'food', 'interior', 'staff', 'product', 'before_after', 'none'];

interface CreativeRender {
  id: string;
  status: string;
}

interface Props {
  formSeed: number;
  advertiserName: string;
  onAdvertiserNameChange: (v: string) => void;
  advertiserIndustry: string;
  onAdvertiserIndustryChange: (v: string) => void;
  campaignName: string;
  onCampaignNameChange: (v: string) => void;
  creativeMessage: string;
  onCreativeMessageChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  creativeFormat: CreativeFormat;
  onCreativeFormatChange: (v: CreativeFormat) => void;
  creativeAudioMode: CreativeAudioMode;
  onCreativeAudioModeChange: (v: CreativeAudioMode) => void;
  creativeAssetKinds: CreativeAssetKind[];
  onToggleCreativeAsset: (v: CreativeAssetKind) => void;
  openAiKey: string;
  onOpenAiKeyChange: (v: string) => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  sourceFiles: File[];
  onSourceFilesChange: (files: File[]) => void;
  bgmFile: File | null;
  onBgmFileChange: (file: File | null) => void;
  isProducing: boolean;
  creativeRender: CreativeRender | null;
  creativeRenderError: string;
  studioView: string;
  onProduce: () => void;
  onGoToResults: () => void;
  industryOptions: string[];
  selectedCreativeAssets: string[];
}

export default function StudioSidebar({
  formSeed,
  advertiserName, onAdvertiserNameChange,
  advertiserIndustry, onAdvertiserIndustryChange,
  campaignName, onCampaignNameChange,
  creativeMessage, onCreativeMessageChange,
  notes, onNotesChange,
  creativeFormat, onCreativeFormatChange,
  creativeAudioMode, onCreativeAudioModeChange,
  creativeAssetKinds, onToggleCreativeAsset,
  openAiKey, onOpenAiKeyChange,
  showAdvanced, onToggleAdvanced,
  sourceFiles, onSourceFilesChange,
  bgmFile, onBgmFileChange,
  isProducing,
  creativeRender,
  creativeRenderError,
  studioView,
  onProduce, onGoToResults,
  industryOptions,
  selectedCreativeAssets,
}: Props) {
  return (
    <>
      <div className="card">
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{
            border: '1px solid rgba(245,158,11,0.22)',
            borderRadius: 16,
            padding: 16,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(49,130,246,0.04))',
            height: 172,
            display: 'grid',
            alignContent: 'start',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>START HERE</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>소재 제작</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              광고주 정보와 소스 파일을 입력해 시안과 결과를 확인합니다.
            </div>
          </div>

          {/* 1. 기본 정보 */}
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>1. 기본 정보</div>
            <div className="form-grid" key={`studio-basic-${formSeed}`}>
              <input type="text" name={`studio-decoy-user-${formSeed}`} autoComplete="username" tabIndex={-1} aria-hidden="true"
                style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
              <input type="password" name={`studio-decoy-pass-${formSeed}`} autoComplete="new-password" tabIndex={-1} aria-hidden="true"
                style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />

              <div className="form-group">
                <label className="form-label">광고주명</label>
                <input className="form-input" type="text" name={`studio_advertiser_name_${formSeed}`} autoComplete="new-password"
                  placeholder="예: OO식당" value={advertiserName} onChange={e => onAdvertiserNameChange(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">광고주 업종</label>
                <input className="form-input" type="text" value={advertiserIndustry}
                  onChange={e => onAdvertiserIndustryChange(e.target.value)}
                  list="studio-industry-options" placeholder="예: 식당, 카페, 학원, 병원" autoComplete="off" />
                <datalist id="studio-industry-options">
                  {industryOptions.map(ind => <option key={ind} value={ind} />)}
                </datalist>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  직접 입력할 수 있고, 자주 쓰는 업종은 자동완성으로 추천됩니다.
                </div>
              </div>

              <div className="form-group full-width">
                <label className="form-label">핵심 문구</label>
                <textarea value={creativeMessage} onChange={e => onCreativeMessageChange(e.target.value)}
                  placeholder="예: 시그니처 메뉴 9,900원 / 신규 등록 할인 / 상담 문의" rows={3}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)',
                    background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
            </div>
          </div>

          {/* 2. 제작 옵션 */}
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>2. 제작 옵션</div>
            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label">소재 형태</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {FORMAT_OPTIONS.map(option => (
                    <button key={option} type="button" onClick={() => onCreativeFormatChange(option)}
                      className={`radius-chip ${creativeFormat === option ? 'active' : ''}`}>
                      {CREATIVE_FORMAT_LABELS[option]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group full-width">
                <label className="form-label">오디오 구성</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {AUDIO_OPTIONS.map(option => (
                    <button key={option} type="button" onClick={() => onCreativeAudioModeChange(option)}
                      className={`radius-chip ${creativeAudioMode === option ? 'active' : ''}`}>
                      {CREATIVE_AUDIO_MODE_LABELS[option]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group full-width">
                <label className="form-label">소스 유형</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ASSET_OPTIONS.map(option => (
                    <button key={option} type="button" onClick={() => onToggleCreativeAsset(option)}
                      className={`radius-chip ${creativeAssetKinds.includes(option) ? 'active' : ''}`}
                      style={option === 'none' ? { borderStyle: 'dashed' } : undefined}>
                      {CREATIVE_ASSET_LABELS[option]}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  기본 제작 규격: 세로형 `1080x1650`, 총 `15초`
                </div>
              </div>
            </div>
          </div>

          {/* 3. 파일 업로드 */}
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>3. 파일 업로드</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>소스 파일 업로드</label>
                <input type="file" accept="image/*,video/*" multiple
                  onChange={e => onSourceFilesChange(Array.from(e.target.files || []))} style={{ width: '100%' }} />
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  사진 2~3장만 올려도 이미지형 15초 영상 생성이 가능합니다.
                </div>
                {sourceFiles.length > 0 && (
                  <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                    {sourceFiles.map(file => (
                      <div key={`${file.name}-${file.size}`} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        • {file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>선택 BGM 업로드</label>
                <input type="file" accept="audio/*"
                  onChange={e => onBgmFileChange(e.target.files?.[0] || null)} style={{ width: '100%' }} />
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  업로드하지 않으면 기본 BGM 또는 AI 멘트로 제작됩니다.
                </div>
                {bgmFile && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>• {bgmFile.name}</div>
                )}
              </div>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>OpenAI API 키 (선택)</label>
                <input className="form-input" type="password" autoComplete="off" spellCheck={false}
                  placeholder="sk-..." value={openAiKey} onChange={e => onOpenAiKeyChange(e.target.value)} />
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  내 키로 이미지, 멘트, 영상 자동 생성을 실행할 때 사용합니다. 서버에 저장하지 않고 현재 브라우저에서만 사용합니다.
                </div>
              </div>
            </div>
          </div>

          {/* 고급 설정 */}
          <button type="button" onClick={onToggleAdvanced}
            style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-white)',
              color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, textAlign: 'left' }}>
            {showAdvanced ? '고급 설정 숨기기' : '고급 설정 보기'}
          </button>

          {showAdvanced && (
            <div style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 14, background: 'var(--bg-input)' }}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">캠페인명</label>
                  <input className="form-input" type="text" name={`studio_campaign_name_${formSeed}`} autoComplete="new-password"
                    placeholder="예: 봄 시즌 광고" value={campaignName} onChange={e => onCampaignNameChange(e.target.value)} />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">내부 메모</label>
                  <textarea value={notes} onChange={e => onNotesChange(e.target.value)}
                    placeholder="예: 광고주 요청사항, 후편집 메모, 피해야 할 표현" rows={3}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)',
                      background: 'var(--bg-white)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
                </div>
              </div>
            </div>
          )}

          {/* 현재 설정 요약 */}
          <div style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--bg-input)', display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>현재 설정 요약</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              광고주: {advertiserName || '미입력'}<br />
              업종: {advertiserIndustry || '미선택'}<br />
              형태: {CREATIVE_FORMAT_LABELS[creativeFormat]} / 오디오: {CREATIVE_AUDIO_MODE_LABELS[creativeAudioMode]}<br />
              소스 유형: {selectedCreativeAssets.join(', ')}
            </div>
          </div>

          <button className="btn btn-primary" onClick={onProduce} disabled={isProducing} style={{ width: '100%' }}>
            {isProducing ? <><span className="loading-spinner" /> 제작 중...</> : '🎥 내부 미리보기 생성'}
          </button>

          {creativeRender && studioView !== 'results' && (
            <button type="button" className="btn btn-secondary" onClick={onGoToResults} style={{ width: '100%' }}>
              ✅ 결과 확인하기
            </button>
          )}

          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7, padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10 }}>
            API 키를 입력하면 내 키로 자동 생성을 실행합니다. 입력하지 않으면 서버에 설정된 키가 있을 때만 자동 생성이 동작합니다.
          </div>

          {creativeRenderError && (
            <div style={{ padding: '10px 12px', background: 'rgba(240,68,82,0.08)', color: 'var(--danger)', borderRadius: 10, fontSize: 12 }}>
              {creativeRenderError}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
