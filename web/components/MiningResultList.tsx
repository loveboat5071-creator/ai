'use client';

import type { MinedBusiness } from '@/lib/miningTypes';

interface Props {
  businesses: MinedBusiness[];
  excludedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (exclude: boolean) => void;
  onResetExcluded: () => void;
  page: number;
  hasMore: boolean;
  totalCount: number | null;
  onNextPage: () => void;
  onPrevPage: () => void;
  isLoading: boolean;
  isSending: boolean;
  onSendToServer: () => void;
}

export default function MiningResultList({
  businesses, excludedIds, onToggle, onToggleAll, onResetExcluded,
  page, hasMore, totalCount, onNextPage, onPrevPage, isLoading,
  isSending, onSendToServer,
}: Props) {
  const selectedCount = businesses.filter(b => !excludedIds.has(b.id)).length;
  const allChecked = businesses.length > 0 && selectedCount === businesses.length;
  const totalPages = totalCount ? Math.ceil(totalCount / 15) : null;

  if (businesses.length === 0) {
    return (
      <div style={{
        padding: 56, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14,
      }}>
        ← 좌측에서 지역과 업종을 검색하면 광고주 후보 리스트가 표시됩니다.
      </div>
    );
  }

  return (
    <div>
      {/* Header controls */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 14,
        padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 12, fontSize: 13,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={allChecked}
              onChange={() => onToggleAll(allChecked)}
              style={{ cursor: 'pointer' }}
            />
            전체 선택
          </label>
          <span style={{ color: 'var(--text-muted)' }}>
            {selectedCount}/{businesses.length}건 선택
            {excludedIds.size > 0 && (
              <button
                onClick={onResetExcluded}
                style={{
                  marginLeft: 8, background: 'none', border: 'none',
                  color: 'var(--accent)', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, textDecoration: 'underline',
                }}
              >
                선택 초기화
              </button>
            )}
          </span>
        </div>

        {/* Send to server button */}
        <button
          className="btn btn-primary"
          onClick={onSendToServer}
          disabled={selectedCount === 0 || isSending}
          style={{ fontSize: 13, padding: '8px 18px', whiteSpace: 'nowrap' }}
        >
          {isSending ? (
            <><span className="loading-spinner" /> 전송 중...</>
          ) : (
            `🚀 서버로 전송 (${selectedCount}건)`
          )}
        </button>
      </div>

      {/* Table */}
      <div className="table-container" style={{ maxHeight: 560, overflowY: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>☑</th>
              <th>No</th>
              <th>업체명</th>
              <th>업종</th>
              <th>주소</th>
              <th>전화번호</th>
              <th>홈페이지</th>
              <th>이메일</th>
              <th>카카오맵</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b, i) => {
              const isExcluded = excludedIds.has(b.id);
              return (
                <tr key={b.id} className={isExcluded ? 'row-excluded' : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!isExcluded}
                      onChange={() => onToggle(b.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{b.name}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.category}>
                    {b.category.includes('>') ? b.category.split('>').pop()?.trim() : b.category}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.address}
                  </td>
                  <td style={{ fontSize: 12 }}>{b.phone || '-'}</td>
                  <td style={{ fontSize: 12 }}>
                    {b.homepageUrl ? (
                      <a href={b.homepageUrl} target="_blank" rel="noreferrer"
                        style={{ color: 'var(--accent)' }} title={b.homepageUrl}>
                        🌐 보기
                      </a>
                    ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                  </td>
                  <td style={{ fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.emails && b.emails.length > 0 ? (
                      <a href={`mailto:${b.emails[0]}`} style={{ color: 'var(--accent)' }} title={b.emails.join(', ')}>
                        📧 {b.emails[0]}
                      </a>
                    ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                  </td>
                  <td>
                    <a href={b.placeUrl} target="_blank" rel="noreferrer"
                      style={{ color: 'var(--accent)', fontSize: 12 }}>
                      보기 →
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 14, marginTop: 16, fontSize: 13,
      }}>
        <button
          className="btn"
          onClick={onPrevPage}
          disabled={page <= 1 || isLoading}
          style={{ fontSize: 12, padding: '8px 16px' }}
        >
          ← 이전
        </button>
        <span style={{ color: 'var(--text-muted)' }}>
          페이지 {page}{totalPages ? ` / ${totalPages}` : ''}
          {totalCount ? <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>(총 {totalCount}건)</span> : null}
        </span>
        <button
          className="btn"
          onClick={onNextPage}
          disabled={!hasMore || isLoading}
          style={{ fontSize: 12, padding: '8px 16px' }}
        >
          다음 →
        </button>
      </div>
    </div>
  );
}
