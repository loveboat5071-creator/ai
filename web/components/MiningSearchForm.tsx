'use client';

import { useState } from 'react';
import { CATEGORY_PRESETS, CATEGORY_GROUP_CODES } from '@/lib/miningTypes';
import type { MiningSearchMode } from '@/lib/miningTypes';

interface Props {
  region: string;
  onRegionChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  searchMode: MiningSearchMode;
  onSearchModeChange: (mode: MiningSearchMode) => void;
  categoryGroupCode: string;
  onCategoryGroupCodeChange: (code: string) => void;
  isSearching: boolean;
  onSearch: () => void;
  error: string;
  onDismissError: () => void;
  totalCount: number | null;
  isEnriching?: boolean;
}

export default function MiningSearchForm({
  region, onRegionChange,
  category, onCategoryChange,
  searchMode, onSearchModeChange,
  categoryGroupCode, onCategoryGroupCodeChange,
  isSearching, onSearch,
  error, onDismissError,
  totalCount,
  isEnriching = false,
}: Props) {
  const [showPresets, setShowPresets] = useState(true);

  return (
    <div className="card" style={{ padding: 24, borderRadius: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 6, letterSpacing: 1.2 }}>ADVERTISER MINING</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>🏪 지역 + 업종 검색</div>
      </div>

      {/* Search mode toggle */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 18,
        padding: 4, background: 'var(--bg-input)', borderRadius: 12,
      }}>
        <button
          type="button"
          onClick={() => onSearchModeChange('category')}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: searchMode === 'category' ? 'var(--accent)' : 'transparent',
            color: searchMode === 'category' ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}
        >
          📂 카테고리 검색
        </button>
        <button
          type="button"
          onClick={() => onSearchModeChange('keyword')}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: searchMode === 'keyword' ? 'var(--accent)' : 'transparent',
            color: searchMode === 'keyword' ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}
        >
          🔤 키워드 검색
        </button>
      </div>

      <div className="form-grid" style={{ gap: 16, marginBottom: 18 }}>
        <div className="form-group full-width">
          <label className="form-label">지역 *</label>
          <input
            className="form-input"
            type="text"
            placeholder={searchMode === 'keyword' ? '예: 인천 송도동, 강남구 역삼동' : '예: 인천 송도, 강남구, 판교'}
            value={region}
            onChange={e => onRegionChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch()}
            style={{ minHeight: 62, padding: '15px 18px' }}
          />
          {searchMode === 'keyword' && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              💡 동 이름까지 입력하면 더 정확한 결과를 얻을 수 있습니다
            </div>
          )}
        </div>

        {searchMode === 'category' ? (
          <div className="form-group full-width">
            <label className="form-label">업종 카테고리 *</label>
            <select
              className="form-input"
              value={categoryGroupCode}
              onChange={e => onCategoryGroupCodeChange(e.target.value)}
              style={{ cursor: 'pointer', minHeight: 62, padding: '15px 18px' }}
            >
              <option value="">— 카테고리 선택 —</option>
              {CATEGORY_GROUP_CODES.map(({ code, label }) => (
                <option key={code} value={code}>{label} ({code})</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="form-group full-width">
            <label className="form-label">
              업종 (키워드) *
              <button
                type="button"
                onClick={() => setShowPresets(p => !p)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'var(--accent)', marginLeft: 8, fontFamily: 'inherit',
                }}
              >
                {showPresets ? '▲ 프리셋 접기' : '▼ 프리셋 보기'}
              </button>
            </label>
            <input
              className="form-input"
              type="text"
              placeholder="예: 안경점, 한의원, 피부과"
              value={category}
              onChange={e => onCategoryChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSearch()}
              style={{ marginBottom: showPresets ? 10 : 0, minHeight: 62, padding: '15px 18px' }}
            />
            {showPresets && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CATEGORY_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onCategoryChange(preset)}
                    className={`radius-chip ${category === preset ? 'active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: 12 }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button
          className="btn btn-primary"
          onClick={onSearch}
          disabled={isSearching}
          style={{ flex: 1, minHeight: 60, fontSize: 15 }}
        >
          {isSearching ? <><span className="loading-spinner" /> 검색 중...</> : '🔍 업체 검색'}
        </button>
      </div>

      {(isSearching || isEnriching || totalCount !== null) && (
        <div style={{
          marginTop: 12, padding: '12px 14px', borderRadius: 10,
          background: isSearching || isEnriching ? 'rgba(49,130,246,0.08)' : 'rgba(34,197,94,0.08)',
          fontSize: 13,
          color: isSearching || isEnriching ? 'var(--accent)' : '#16a34a',
          fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {isSearching ? (
            <><span className="loading-spinner" style={{ width: 14, height: 14 }} /> 🔍 업체 검색중...</>
          ) : isEnriching ? (
            <><span className="loading-spinner" style={{ width: 14, height: 14 }} /> 🌐 홈페이지 · 이메일 크롤링중...</>
          ) : totalCount !== null ? (
            <>✅ 총 {totalCount.toLocaleString()}건 검색 · 크롤링 완료</>
          ) : null}
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 12, padding: '12px 14px', borderRadius: 12,
          background: 'rgba(239,68,68,0.08)', color: '#dc2626', fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>⚠️ {error}</span>
          <button onClick={onDismissError} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#dc2626',
          }}>✕</button>
        </div>
      )}

      {/* Kakao API 한계사항 안내 */}
      <div style={{
        marginTop: 18, padding: '14px 16px', borderRadius: 12,
        background: 'var(--bg-input)', fontSize: 11, color: 'var(--text-muted)',
        lineHeight: 1.75,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
          ℹ️ 카카오 API 안내
        </div>
        {searchMode === 'category' ? (
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li><b>대분류</b> 카테고리만 지원 (병원, 음식점, 학원 등)</li>
            <li>지역 중심 반경 3km 그리드 확장 검색 (<b>최대 ~300건</b>)</li>
            <li>동 단위 입력 가능 (예: 강남구 역삼동)</li>
            <li>안경점, 피부과 등 <b>중·하분류</b>는 → 키워드 검색 사용</li>
          </ul>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li><b>중·하분류 업종</b>에 최적 (안경점, 피부과, 필라테스 등)</li>
            <li>카카오 키워드 검색은 쿼리당 <b>최대 45건</b> 제한</li>
            <li>동 이름까지 입력하면 더 정확한 결과</li>
          </ul>
        )}
      </div>
    </div>
  );
}
