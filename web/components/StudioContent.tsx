'use client';

import Image from 'next/image';
import {
  CREATIVE_ASSET_LABELS,
  CREATIVE_AUDIO_MODE_LABELS,
  CREATIVE_FORMAT_LABELS,
} from '@/lib/creativePlan';
import type { CreativeAssetKind, CreativeBrief, CreativeFormat, CreativePlan } from '@/lib/types';
import type { CreativeAssetRecord, CreativeVideoJobRecord } from '@/lib/creativeStudio';
import StudioStepIndicator from '@/components/StudioStepIndicator';

type StudioView = 'overview' | 'prompts' | 'api' | 'results';

interface CreativeRender {
  id: string;
  created_at: string;
  status: 'processing' | 'completed' | 'failed' | 'partial';
  brief: CreativeBrief;
  source_assets: CreativeAssetRecord[];
  image_assets: CreativeAssetRecord[];
  output_assets: CreativeAssetRecord[];
  video_jobs: CreativeVideoJobRecord[];
  warnings: string[];
  errors: string[];
  plan: CreativePlan;
}

interface StudioStep {
  key: string;
  title: string;
  description: string;
  done: boolean;
}

interface Props {
  studioView: StudioView;
  onSetStudioView: (v: StudioView) => void;
  studioSteps: StudioStep[];
  studioPlan: CreativePlan;
  studioCreativeFormat: CreativeFormat;
  studioStatusLabel: string;
  sourceFilesCount: number;
  advertiserName: string;
  advertiserIndustry: string;
  copiedCreativeKey: string;
  onCopyCreativeText: (key: string, value: string) => void;
  studioPlanApiPayload: string;
  creativeProduceEndpoint: string;
  creativeStatusEndpoint: string;
  creativeRender: CreativeRender | null;
  onRefreshCreativeRender: (id: string, refresh?: boolean) => Promise<unknown>;
  creativeHistory: CreativeRender[];
  creativeHistoryError: string;
  isLoadingCreativeHistory: boolean;
  onLoadCreativeHistory: () => void;
  onApplyHistoryItem: (item: CreativeRender) => void;
  onSetCreativeRender: (item: CreativeRender) => void;
}

export default function StudioContent({
  studioView, onSetStudioView,
  studioSteps,
  studioPlan, studioCreativeFormat, studioStatusLabel, sourceFilesCount,
  advertiserName, advertiserIndustry,
  copiedCreativeKey, onCopyCreativeText,
  studioPlanApiPayload, creativeProduceEndpoint, creativeStatusEndpoint,
  creativeRender, onRefreshCreativeRender,
  creativeHistory, creativeHistoryError, isLoadingCreativeHistory, onLoadCreativeHistory,
  onApplyHistoryItem, onSetCreativeRender,
}: Props) {
  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div style={{ display: 'grid', gap: 16 }}>
        {/* 헤더 */}
        <div style={{
          border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: 16,
          background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(49,130,246,0.05))',
          height: 172, display: 'grid', alignContent: 'start',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>GUIDE</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>제작 가이드</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            Canva 제작, API 연결, 생성 결과를 메뉴별로 확인합니다.
          </div>
        </div>

        {/* 상태 요약 */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <div className="stat-card" style={{ textAlign: 'left', padding: 16, height: '100%' }}>
            <div className="stat-label">소재 형태</div>
            <div className="stat-value" style={{ fontSize: 16 }}>{CREATIVE_FORMAT_LABELS[studioCreativeFormat]}</div>
          </div>
          <div className="stat-card" style={{ textAlign: 'left', padding: 16, height: '100%' }}>
            <div className="stat-label">오디오</div>
            <div className="stat-value" style={{ fontSize: 16 }}>{studioPlan.audio.mode_label}</div>
          </div>
          <div className="stat-card" style={{ textAlign: 'left', padding: 16, height: '100%' }}>
            <div className="stat-label">업로드 소스</div>
            <div className="stat-value" style={{ fontSize: 16 }}>{sourceFilesCount}개</div>
          </div>
          <div className="stat-card" style={{ textAlign: 'left', padding: 16, height: '100%' }}>
            <div className="stat-label">현재 상태</div>
            <div className="stat-value" style={{ fontSize: 16 }}>{studioStatusLabel}</div>
          </div>
        </div>

        <StudioStepIndicator steps={studioSteps} />

        {/* 탭 */}
        <div className="tabs">
          {([
            { key: 'overview', label: '🧭 시작하기' },
            { key: 'prompts', label: '🪄 Canva 제작' },
            { key: 'api', label: '🔌 API 연동' },
            { key: 'results', label: '🎞️ 결과' },
          ] as { key: StudioView; label: string }[]).map(item => (
            <button key={item.key}
              className={`tab ${studioView === item.key ? 'active' : ''}`}
              onClick={() => onSetStudioView(item.key)}>
              {item.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {studioView === 'overview' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 18,
              background: 'linear-gradient(135deg, rgba(49,130,246,0.08), rgba(0,196,113,0.05))' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>{studioPlan.profile_label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{studioPlan.concept_title}</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 10 }}>{studioPlan.concept_summary}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {studioPlan.recommended_keywords.map(keyword => (
                  <span key={keyword} style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999,
                    background: 'var(--bg-white)', border: '1px solid rgba(49,130,246,0.18)', fontSize: 12, fontWeight: 600 }}>
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'grid', gap: 10, height: '100%', alignContent: 'start' }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>지금 해야 할 일</div>
                {studioSteps.map((step, index) => (
                  <div key={step.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 26, height: 26, borderRadius: 999,
                      background: step.done ? 'rgba(16,185,129,0.14)' : 'var(--bg-input)',
                      color: step.done ? '#047857' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                      {index + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{step.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 4 }}>{step.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'grid', gap: 10, height: '100%', alignContent: 'start' }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>현재 제작 요약</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  광고주: <strong style={{ color: 'var(--text-primary)' }}>{advertiserName || '미입력'}</strong><br />
                  업종: <strong style={{ color: 'var(--text-primary)' }}>{advertiserIndustry || '미선택'}</strong><br />
                  콘셉트: <strong style={{ color: 'var(--text-primary)' }}>{CREATIVE_FORMAT_LABELS[studioCreativeFormat]}</strong><br />
                  오디오: <strong style={{ color: 'var(--text-primary)' }}>{studioPlan.audio.mode_label}</strong><br />
                  소스 전략: {studioPlan.image_package.source_strategy}
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--bg-input)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  이미지형은 {studioPlan.image_package.composition}, 동영상형은 {studioPlan.video_package.style} 기준으로 잡혀 있습니다.
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, height: '100%' }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>필수 자료</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {studioPlan.required_assets.map(item => (
                    <div key={item} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>• {item}</div>
                  ))}
                </div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, height: '100%' }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>오디오 가이드</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{studioPlan.audio.mode_label}</strong><br />
                  BGM: {studioPlan.audio.bgm}
                </div>
                <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                  {studioPlan.audio.narration_lines.map(line => (
                    <div key={line} style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-input)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Prompts (Canva) */}
        {studioView === 'prompts' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'grid', gap: 12,
              background: 'linear-gradient(135deg, rgba(138,92,246,0.06), rgba(49,130,246,0.04))', height: '100%', alignContent: 'start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Canva 제작 가이드</div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  Canva에 바로 붙여 넣을 수 있는 문구와 컷별 프롬프트를 정리했습니다.
                </div>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {studioPlan.delivery_paths.canva.steps.map(step => (
                  <div key={step} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>• {step}</div>
                ))}
              </div>
              {[
                { key: 'canva-master', label: '마스터 프롬프트', value: studioPlan.delivery_paths.canva.master_prompt },
                { key: 'canva-video', label: '영상 프롬프트', value: studioPlan.delivery_paths.canva.video_prompt },
                { key: 'canva-copy', label: '카피/멘트 프롬프트', value: studioPlan.delivery_paths.canva.copy_prompt },
              ].map(item => (
                <div key={item.key} style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{item.label}</div>
                    <button className="btn btn-secondary"
                      onClick={() => onCopyCreativeText(item.key, item.value)}
                      style={{ padding: '6px 10px', fontSize: 11 }}>
                      {copiedCreativeKey === item.key ? '복사됨' : '복사'}
                    </button>
                  </div>
                  <textarea readOnly value={item.value} rows={item.key === 'canva-master' ? 7 : 5}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.6,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', resize: 'vertical' }} />
                </div>
              ))}
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'grid', gap: 12, height: '100%', alignContent: 'start' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>컷별 프롬프트</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                이미지형 컷 제작이나 보정 요청에 그대로 붙여넣을 수 있습니다.
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {studioPlan.delivery_paths.canva.image_scene_prompts.map((prompt, index) => {
                  const key = `canva-scene-${index}`;
                  return (
                    <div key={key} style={{ display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>컷 프롬프트 {index + 1}</div>
                        <button className="btn btn-secondary"
                          onClick={() => onCopyCreativeText(key, prompt)}
                          style={{ padding: '6px 10px', fontSize: 11 }}>
                          {copiedCreativeKey === key ? '복사됨' : '복사'}
                        </button>
                      </div>
                      <textarea readOnly value={prompt} rows={4}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
                          background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.6,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', resize: 'vertical' }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* API */}
        {studioView === 'api' && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>API 연동 가이드</div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                자동 제작 시스템과 연결할 때 필요한 설정만 모아두었습니다. Canva만 사용할 경우 이 메뉴는 건너뛰어도 됩니다.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'grid', gap: 10, height: '100%', alignContent: 'start' }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>내 키로 자동 생성하기</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  왼쪽 입력 영역의 `OpenAI API 키` 칸에 키를 넣으면 내 키로 이미지, 멘트, 영상 생성을 실행합니다.<br />
                  Canva에서 수동으로 제작할 때는 API 키가 필요 없습니다.
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  키 이름: <strong>OPENAI_API_KEY</strong><br />
                  저장 방식: 현재 브라우저 세션에서만 사용
                </div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'grid', gap: 10, height: '100%', alignContent: 'start' }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>API 키 발급 방법</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  1. OpenAI Platform에 로그인합니다.<br />
                  2. API Keys 페이지에서 새 secret key를 만듭니다.<br />
                  3. 발급 직후 복사해서 안전하게 보관합니다.<br />
                  4. 발급한 키를 이 화면의 `OpenAI API 키` 칸에 붙여 넣습니다.
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer"
                    className="btn btn-secondary" style={{ padding: '8px 12px', textDecoration: 'none' }}>
                    API Keys 열기
                  </a>
                  <a href="https://platform.openai.com/docs/quickstart" target="_blank" rel="noreferrer"
                    className="btn btn-secondary" style={{ padding: '8px 12px', textDecoration: 'none' }}>
                    OpenAI 시작 가이드
                  </a>
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--bg-input)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <strong>연동 주소</strong><br />
              기획안 API: {studioPlan.delivery_paths.internal_api.method} {studioPlan.delivery_paths.internal_api.endpoint}<br />
              실제 생성 API: {creativeProduceEndpoint} / {creativeStatusEndpoint}
            </div>
            <details style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                개발자용 요청 예시 보기
              </summary>
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>필수 필드</div>
                    {studioPlan.delivery_paths.internal_api.required_fields.map(field => (
                      <div key={field} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>• {field}</div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>응답/후속 경로</div>
                    {studioPlan.delivery_paths.internal_api.outputs.map(item => (
                      <div key={item} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>• {item}</div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>요청 예시 JSON</div>
                    <button className="btn btn-secondary"
                      onClick={() => onCopyCreativeText('api-payload', studioPlanApiPayload)}
                      style={{ padding: '6px 10px', fontSize: 11 }}>
                      {copiedCreativeKey === 'api-payload' ? '복사됨' : '복사'}
                    </button>
                  </div>
                  <textarea readOnly value={studioPlanApiPayload} rows={10}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.6,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', resize: 'vertical' }} />
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Results */}
        {studioView === 'results' && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>실제 제작 결과</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  이미지형은 즉시 합성되고, 동영상형 작업은 완료될 때까지 자동 갱신됩니다.
                </div>
              </div>
              {creativeRender?.id && (
                <button className="btn btn-secondary"
                  onClick={() => void onRefreshCreativeRender(creativeRender.id, true)}
                  style={{ padding: '10px 14px' }}>
                  상태 새로고침
                </button>
              )}
            </div>

            {!creativeRender ? (
              <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: 13 }}>
                좌측의 `내부 미리보기 생성` 버튼을 누르면 업로드 파일과 현재 기획안을 기반으로 실제 이미지/영상 결과물이 생성됩니다.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span className="badge" style={{
                    background: creativeRender.status === 'completed' ? 'var(--success-bg)'
                      : creativeRender.status === 'failed' ? 'var(--danger-bg)' : 'rgba(49,130,246,0.10)',
                    color: creativeRender.status === 'completed' ? 'var(--success)'
                      : creativeRender.status === 'failed' ? 'var(--danger)' : 'var(--accent)',
                  }}>
                    {creativeRender.status === 'completed' && '완료'}
                    {creativeRender.status === 'processing' && '생성 중'}
                    {creativeRender.status === 'partial' && '부분 완료'}
                    {creativeRender.status === 'failed' && '실패'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>작업 ID: {creativeRender.id}</span>
                </div>

                {creativeRender.video_jobs.length > 0 && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {creativeRender.video_jobs.map(job => (
                      <div key={job.key} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{job.title}</div>
                          <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>{job.status}</span>
                        </div>
                        {job.url && <a href={job.url} target="_blank" rel="noreferrer" style={{ marginTop: 6, display: 'inline-block', fontSize: 12 }}>원본 클립 열기</a>}
                        {job.error && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>{job.error}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {creativeRender.output_assets.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                    {creativeRender.output_assets.map(asset => (
                      <div key={asset.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{asset.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            {asset.kind === 'video' && 'MP4 결과물'}
                            {asset.kind === 'image' && '이미지 결과물'}
                            {asset.kind === 'audio' && '오디오 결과물'}
                          </div>
                        </div>
                        {asset.kind === 'video' && <video controls preload="metadata" src={asset.url} style={{ width: '100%', borderRadius: 10, background: '#000' }} />}
                        {asset.kind === 'image' && (
                          <div style={{ position: 'relative', width: '100%', aspectRatio: '1080 / 1650', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-input)' }}>
                            <Image src={asset.url} alt={asset.title} fill unoptimized style={{ objectFit: 'cover' }} />
                          </div>
                        )}
                        {asset.kind === 'audio' && <audio controls preload="metadata" src={asset.url} style={{ width: '100%' }} />}
                        <a href={asset.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600 }}>파일 열기</a>
                      </div>
                    ))}
                  </div>
                )}

                {creativeRender.image_assets.length > 0 && (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>생성/사용된 이미지 컷</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                      {creativeRender.image_assets.map(asset => (
                        <div key={asset.id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-input)' }}>
                          <div style={{ position: 'relative', width: '100%', aspectRatio: '1080 / 1650' }}>
                            <Image src={asset.url} alt={asset.title} fill unoptimized style={{ objectFit: 'cover' }} />
                          </div>
                          <div style={{ padding: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{asset.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                              {asset.source === 'upload' ? '업로드 소스' : 'AI 생성'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {creativeRender.warnings.length > 0 && (
                  <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.10)', color: '#a16207',
                    fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                    {creativeRender.warnings.map(item => <div key={item}>• {item}</div>)}
                  </div>
                )}
                {creativeRender.errors.length > 0 && (
                  <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(240,68,82,0.08)', color: 'var(--danger)',
                    fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                    {creativeRender.errors.map(item => <div key={item}>• {item}</div>)}
                  </div>
                )}
              </div>
            )}

            {/* 최근 생성물 */}
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>최근 생성물</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    생성된 소재와 당시 설정값을 다시 확인하고 같은 조건으로 이어서 작업할 수 있습니다.
                  </div>
                </div>
                <button className="btn btn-secondary" onClick={onLoadCreativeHistory}
                  disabled={isLoadingCreativeHistory} style={{ padding: '10px 14px' }}>
                  {isLoadingCreativeHistory ? '불러오는 중...' : '목록 새로고침'}
                </button>
              </div>

              {creativeHistoryError && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(240,68,82,0.08)', color: 'var(--danger)',
                  fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  {creativeHistoryError}
                </div>
              )}

              {!isLoadingCreativeHistory && creativeHistory.length === 0 && !creativeHistoryError && (
                <div style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: 13 }}>
                  아직 저장된 생성물이 없습니다. 시안을 한 번 만들면 여기서 최근 생성 목록과 설정값을 함께 확인할 수 있습니다.
                </div>
              )}

              {creativeHistory.length > 0 && (
                <div style={{ display: 'grid', gap: 14 }}>
                  {creativeHistory.map(item => {
                    const brief = item.brief;
                    const formatLabel = CREATIVE_FORMAT_LABELS[brief.preferred_format || 'both'];
                    const audioLabel = CREATIVE_AUDIO_MODE_LABELS[brief.audio_mode || 'bgm_narration'];
                    const assetKinds = ((brief.asset_kinds && brief.asset_kinds.length > 0
                      ? brief.asset_kinds : ['none']) as CreativeAssetKind[])
                      .map(kind => CREATIVE_ASSET_LABELS[kind]).join(', ');
                    const primaryAsset =
                      item.output_assets.find(a => a.role === 'render' && a.kind === 'video') ||
                      item.output_assets.find(a => a.role === 'render' && a.kind === 'image') ||
                      item.output_assets.find(a => a.kind === 'video') ||
                      item.output_assets.find(a => a.kind === 'image');
                    const isCurrentItem = creativeRender?.id === item.id;

                    return (
                      <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14, display: 'grid', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                          <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                            {primaryAsset?.kind === 'video' && (
                              <video controls preload="metadata" src={primaryAsset.url} style={{ width: '100%', borderRadius: 12, background: '#000' }} />
                            )}
                            {primaryAsset?.kind === 'image' && (
                              <div style={{ position: 'relative', width: '100%', aspectRatio: '1080 / 1650', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-input)' }}>
                                <Image src={primaryAsset.url} alt={primaryAsset.title} fill unoptimized style={{ objectFit: 'cover' }} />
                              </div>
                            )}
                            {!primaryAsset && (
                              <div style={{ minHeight: 160, borderRadius: 12, background: 'var(--bg-input)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                                미리보기 없음
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {item.output_assets.map(asset => (
                                <a key={asset.id} href={asset.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600 }}>
                                  {asset.title}
                                </a>
                              ))}
                            </div>
                          </div>

                          <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontSize: 16, fontWeight: 700 }}>{brief.advertiser_name || '광고주 미입력'}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                  {brief.campaign_name || '캠페인명 없음'} · {new Date(item.created_at).toLocaleString('ko-KR')}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <span className="badge" style={{
                                  background: item.status === 'completed' ? 'var(--success-bg)' : item.status === 'failed' ? 'var(--danger-bg)' : 'rgba(49,130,246,0.10)',
                                  color: item.status === 'completed' ? 'var(--success)' : item.status === 'failed' ? 'var(--danger)' : 'var(--accent)',
                                }}>
                                  {item.status === 'completed' && '완료'}
                                  {item.status === 'processing' && '생성 중'}
                                  {item.status === 'partial' && '부분 완료'}
                                  {item.status === 'failed' && '실패'}
                                </span>
                                {isCurrentItem && (
                                  <span className="badge" style={{ background: 'rgba(49,130,246,0.10)', color: 'var(--accent)' }}>현재 확인 중</span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>형태 {formatLabel}</span>
                              <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>오디오 {audioLabel}</span>
                              <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>소스 유형 {assetKinds}</span>
                              <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>업로드 {item.source_assets.length}개</span>
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                업종: <strong style={{ color: 'var(--text-primary)' }}>{brief.advertiser_industry || '미선택'}</strong><br />
                                작업 ID: <strong style={{ color: 'var(--text-primary)' }}>{item.id}</strong>
                              </div>
                              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg-input)', fontSize: 13,
                                color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>핵심 문구</strong><br />
                                {brief.message || '입력된 문구 없음'}
                              </div>
                              {brief.notes && (
                                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(49,130,246,0.06)', fontSize: 12,
                                  color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                  <strong style={{ color: 'var(--text-primary)' }}>메모</strong><br />
                                  {brief.notes}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button className="btn btn-secondary" onClick={() => onApplyHistoryItem(item)} style={{ padding: '10px 14px' }}>
                                이 설정 불러오기
                              </button>
                              {!isCurrentItem && (
                                <button className="btn btn-secondary" onClick={() => onSetCreativeRender(item)} style={{ padding: '10px 14px' }}>
                                  이 결과 보기
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
