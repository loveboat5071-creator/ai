'use client';

import { CREATIVE_FORMAT_LABELS } from '@/lib/creativePlan';
import type { CreativeFormat } from '@/lib/types';

interface Scene {
  title: string;
  duration_sec: number;
  visual: string;
  copy: string;
}

interface Beat {
  time_range: string;
  visual: string;
  copy: string;
}

interface CreativePlan {
  profile_label: string;
  concept_title: string;
  concept_summary: string;
  recommended_keywords: string[];
  required_assets: string[];
  production_checklist: string[];
  audio: { mode_label: string; bgm: string; narration_lines: string[] };
  image_package: { composition: string; recommendation: string; source_strategy: string; scenes: Scene[] };
  video_package: { style: string; recommendation: string; beats: Beat[] };
}

interface Props {
  creativePlan: CreativePlan;
  creativeFormat: CreativeFormat;
}

export default function CreativePlanPanel({ creativePlan, creativeFormat }: Props) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 18, background: 'linear-gradient(135deg, rgba(49,130,246,0.08), rgba(0,196,113,0.05))' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>{creativePlan.profile_label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{creativePlan.concept_title}</div>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 10 }}>{creativePlan.concept_summary}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {creativePlan.recommended_keywords.map(keyword => (
            <span key={keyword} style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 999, background: 'var(--bg-white)', border: '1px solid rgba(49,130,246,0.18)', fontSize: 12, fontWeight: 600 }}>
              {keyword}
            </span>
          ))}
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="stat-card" style={{ textAlign: 'left', padding: 16 }}>
          <div className="stat-label">소재 형태</div>
          <div className="stat-value" style={{ fontSize: 16 }}>{CREATIVE_FORMAT_LABELS[creativeFormat]}</div>
        </div>
        <div className="stat-card" style={{ textAlign: 'left', padding: 16 }}>
          <div className="stat-label">오디오</div>
          <div className="stat-value" style={{ fontSize: 16 }}>{creativePlan.audio.mode_label}</div>
        </div>
        <div className="stat-card" style={{ textAlign: 'left', padding: 16 }}>
          <div className="stat-label">샘플 규격</div>
          <div className="stat-value" style={{ fontSize: 16 }}>1080x1650 / 15초</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>이미지형 편집안</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{creativePlan.image_package.composition}</strong><br />
            {creativePlan.image_package.recommendation}<br />
            소스 전략: {creativePlan.image_package.source_strategy}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {creativePlan.image_package.scenes.map(scene => (
              <div key={scene.title} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--bg-input)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{scene.title} · {scene.duration_sec}초</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>{scene.visual}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{scene.copy}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>동영상형 편집안</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{creativePlan.video_package.style}</strong><br />
            {creativePlan.video_package.recommendation}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {creativePlan.video_package.beats.map(beat => (
              <div key={beat.time_range} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{beat.time_range}</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 3 }}>{beat.visual}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>{beat.copy}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>오디오 가이드</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{creativePlan.audio.mode_label}</strong><br />
            BGM: {creativePlan.audio.bgm}
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            {creativePlan.audio.narration_lines.map(line => (
              <div key={line} style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-input)', fontSize: 13, color: 'var(--text-secondary)' }}>{line}</div>
            ))}
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>필수 자료</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {creativePlan.required_assets.map(item => (
              <div key={item} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>• {item}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>제작 체크리스트</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {creativePlan.production_checklist.map(item => (
            <div key={item} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>• {item}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
