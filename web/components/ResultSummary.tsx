'use client';

interface AppliedFilters {
  districts: string[];
  require_ev: boolean;
  sort_by: string;
}

interface SearchResult {
  total_count: number;
  total_units: number;
  total_households: number;
  total_price_4w: number;
  applied_filters: AppliedFilters;
}

interface ExportColumn {
  key: string;
  label: string;
  required?: boolean;
}

interface Props {
  result: SearchResult;
  exportColumns: ExportColumn[];
  excludedColumns: Set<string>;
  onToggleColumn: (key: string) => void;
  includeCreative: boolean;
  onIncludeCreativeChange: (v: boolean) => void;
  proposalNotes: string;
  onProposalNotesChange: (v: string) => void;
  isGeneratingExcel: boolean;
  isGeneratingPpt: boolean;
  onDownloadExcel: () => void;
  onDownloadPpt: () => void;
  onPreviewPdf: () => void;
}

function fmt(v: number | null | undefined): string {
  if (v == null) return '-';
  return v.toLocaleString('ko-KR');
}

export default function ResultSummary({
  result,
  exportColumns,
  excludedColumns,
  onToggleColumn,
  includeCreative,
  onIncludeCreativeChange,
  proposalNotes,
  onProposalNotesChange,
  isGeneratingExcel,
  isGeneratingPpt,
  onDownloadExcel,
  onDownloadPpt,
  onPreviewPdf,
}: Props) {
  return (
    <div className="card">
      <div className="card-title"><span className="icon">📊</span> 검색 결과 요약</div>

      <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat-card">
          <div className="stat-value">{fmt(result.total_count)}</div>
          <div className="stat-label">가용 단지</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fmt(result.total_units)}</div>
          <div className="stat-label">총 판매수량</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fmt(result.total_households)}</div>
          <div className="stat-label">총 세대수</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fmt(result.total_price_4w)}</div>
          <div className="stat-label">4주 총 금액</div>
        </div>
      </div>

      {(result.applied_filters.districts.length > 0 || result.applied_filters.require_ev || result.applied_filters.sort_by !== 'distance') && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {result.applied_filters.districts.length > 0 && (
            <div>지역: {result.applied_filters.districts.join(', ')}</div>
          )}
          {result.applied_filters.require_ev && (
            <div>⚡ 전기차 충전기 설치 단지만</div>
          )}
          {result.applied_filters.sort_by === 'public_price_desc' && (
            <div>정렬: 공시가격 높은순</div>
          )}
          {result.applied_filters.sort_by === 'public_price_per_m2_desc' && (
            <div>정렬: 공시가격/㎡ 높은순</div>
          )}
          {result.applied_filters.sort_by === 'rt_price_per_m2_desc' && (
            <div>정렬: 실거래가/㎡ 높은순</div>
          )}
        </div>
      )}

      <div className="btn-row" style={{ flexDirection: 'column', gap: 8 }}>
        <button
          className="btn btn-success"
          onClick={onDownloadExcel}
          disabled={isGeneratingExcel || isGeneratingPpt}
          style={{ width: '100%' }}
        >
          {isGeneratingExcel ? <><span className="loading-spinner" /> Excel 생성 중...</> : '📥 견적서 Excel 다운로드'}
        </button>
        <button
          className="btn btn-primary"
          onClick={onDownloadPpt}
          disabled={isGeneratingExcel || isGeneratingPpt}
          style={{ width: '100%' }}
        >
          {isGeneratingPpt ? <><span className="loading-spinner" /> PPT 생성 중...</> : '📊 견적서 PPT 다운로드'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={onPreviewPdf}
          style={{ width: '100%' }}
        >
          📄 견적서 PDF 미리보기
        </button>
      </div>

      {/* 소재 제작 섹션 포함 토글 */}
      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeCreative}
            onChange={e => onIncludeCreativeChange(e.target.checked)}
          />
          🎨 소재 제작 제안 포함 (PPT/PDF)
        </label>
      </div>

      {/* 가동리스트 컬럼 선택 */}
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
          📋 가동리스트 출력 항목
        </label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {exportColumns.map(col => {
            const isIncluded = !excludedColumns.has(col.key);
            return (
              <button
                key={col.key}
                type="button"
                disabled={col.required}
                onClick={() => onToggleColumn(col.key)}
                className={`radius-chip ${isIncluded ? 'active' : ''}`}
                style={{ fontSize: 11, padding: '3px 8px', opacity: col.required ? 0.6 : 1 }}
              >
                {col.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 추가 안내사항 */}
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
          📝 추가 안내사항 (PPT/PDF 에 포함)
        </label>
        <textarea
          value={proposalNotes}
          onChange={e => onProposalNotesChange(e.target.value)}
          placeholder="예: 특별 할인 조건, 캐페인 주의사항 등"
          rows={3}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-input)',
            color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      </div>
    </div>
  );
}
