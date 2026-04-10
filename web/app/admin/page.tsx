'use client';

import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';

interface UploadResult {
  success: boolean;
  message: string;
  count: number;
  headers_detected?: string[];
  preview?: Record<string, unknown>[];
  storage?: string;
  enrichment?: {
    matchedRows: number;
    latLngFilled: number;
    restrictionsFilled: number;
    pricingFilled: number;
    evFilled: number;
  };
}

interface Coverage {
  count: number;
  withLatLng: number;
  withRestrictions: number;
  withPricing: number;
  withEv: number;
  industries: number;
  districts: number;
}

interface SnapshotStatus {
  storage: 'blob' | 'local';
  available: boolean;
  pathname: string;
  displayName?: string;
  access?: 'public' | 'private';
  uploadedAt?: string;
  size?: number;
  coverage?: Coverage;
  error?: string;
}

interface ActivityLogStatus {
  storage: 'blob' | 'local' | 'disabled';
  enabled: boolean;
  fileCount: number;
  totalEntries: number;
  latestTimestamp?: string;
  latestPath?: string;
  message?: string;
}

interface AdminStatusResponse {
  masterData: {
    effectiveSource: 'blob' | 'local';
    blob: SnapshotStatus;
    local: SnapshotStatus;
  };
  activityLogs: ActivityLogStatus;
  generatedAt: string;
}

export default function AdminPage() {
  // ── 업로드 ─────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<AdminStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError('');
    try {
      const resp = await fetch('/api/admin/status', { cache: 'no-store' });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || '관리자 상태 조회 실패');
      }
      setStatus(data);
    } catch (e) {
      setStatusError(String(e));
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleUpload = useCallback(async (action: 'preview' | 'save') => {
    if (!file) { setError('파일을 선택해주세요.'); return; }
    if (action === 'save') {
      setIsSaving(true);
    } else {
      setIsUploading(true);
    }
    setError(''); setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (action === 'save') formData.append('action', 'save');
      const resp = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await resp.json();
      if (!resp.ok && !data.success) { setError(data.error || '업로드 실패'); return; }
      setResult(data);
      if (action === 'save') {
        void loadStatus();
      }
    } catch (e) { setError(`업로드 실패: ${e}`); }
    finally { setIsUploading(false); setIsSaving(false); }
  }, [file, loadStatus]);

  const fmt = (v: unknown) => {
    if (v == null) return '-';
    if (typeof v === 'number') return v.toLocaleString('ko-KR');
    return String(v);
  };

  const fmtDateTime = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('ko-KR');
  };

  const fmtSize = (value?: number) => {
    if (!value) return '-';
    if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${value} B`;
  };

  const getFileName = (pathname?: string) => {
    if (!pathname) return '-';
    const normalized = pathname.replace(/\\/g, '/');
    return normalized.split('/').filter(Boolean).pop() || pathname;
  };

  const renderCoverage = (coverage?: Coverage) => {
    if (!coverage) return null;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 10 }}>
        <div style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>총 건수</div>
          <div style={{ fontWeight: 700 }}>{fmt(coverage.count)}</div>
        </div>
        <div style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>좌표 보유</div>
          <div style={{ fontWeight: 700 }}>{fmt(coverage.withLatLng)}</div>
        </div>
        <div style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>영업제한 보유</div>
          <div style={{ fontWeight: 700 }}>{fmt(coverage.withRestrictions)}</div>
        </div>
        <div style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>가격 보유</div>
          <div style={{ fontWeight: 700 }}>{fmt(coverage.withPricing)}</div>
        </div>
        <div style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>EV 보유</div>
          <div style={{ fontWeight: 700 }}>{fmt(coverage.withEv)}</div>
        </div>
        <div style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>업종 수</div>
          <div style={{ fontWeight: 700 }}>{fmt(coverage.industries)}</div>
        </div>
      </div>
    );
  };

  // ── 관리자 ──────────────────────────
  return (
    <div className="app-container" style={{ maxWidth: 1080 }}>
      <header className="header">
        <h1 onClick={() => { window.location.href = '/'; }} style={{ cursor: 'pointer' }}>⚙️ 관리자 페이지</h1>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span><span className="icon">🗂️</span> 현재 적용 데이터 상태</span>
            <button className="btn btn-primary" onClick={() => void loadStatus()} disabled={statusLoading} style={{ minWidth: 96 }}>
              {statusLoading ? '확인 중...' : '새로고침'}
            </button>
          </div>
          {statusError && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--danger-bg)', borderRadius: 8, color: 'var(--danger)', fontSize: 13 }}>
              ❌ {statusError}
            </div>
          )}
          {status && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
              <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>현재 적용 데이터 파일</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {status.masterData.effectiveSource === 'blob'
                    ? (status.masterData.blob.displayName || getFileName(status.masterData.blob.pathname))
                    : (status.masterData.local.displayName || getFileName(status.masterData.local.pathname))}
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                  마지막 상태 조회: {fmtDateTime(status.generatedAt)}
                </div>
              </div>

              <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>작업 로그 저장 상태</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {status.activityLogs.enabled ? `활성 (${status.activityLogs.storage})` : '비활성'}
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                  파일 수 {fmt(status.activityLogs.fileCount)} / 로그 {fmt(status.activityLogs.totalEntries)}건
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  최신 기록: {fmtDateTime(status.activityLogs.latestTimestamp)}
                </div>
                {status.activityLogs.latestPath && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                    {status.activityLogs.latestPath}
                  </div>
                )}
                {status.activityLogs.message && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>
                    {status.activityLogs.message}
                  </div>
                )}
              </div>

              {[status.masterData.blob, status.masterData.local].map((snapshot) => (
                <div key={`${snapshot.storage}-${snapshot.pathname}`} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>
                      {snapshot.storage === 'blob' ? '운영 데이터 파일' : '기본 번들 파일'}
                    </div>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: snapshot.available ? 'var(--accent-bg)' : 'var(--danger-bg)',
                      color: snapshot.available ? 'var(--accent)' : 'var(--danger)',
                    }}>
                      {snapshot.available ? '사용 가능' : '읽기 실패'}
                    </span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                    파일명: {snapshot.displayName || getFileName(snapshot.pathname)}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    크기: {fmtSize(snapshot.size)} / 업로드: {fmtDateTime(snapshot.uploadedAt)}
                  </div>
                  {snapshot.error && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>{snapshot.error}</div>
                  )}
                  {renderCoverage(snapshot.coverage)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title"><span className="icon">📤</span> 엑셀 파일 업로드</div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="file-upload" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: 32, border: '2px dashed var(--border)', borderRadius: 14,
              background: 'var(--bg-input)', cursor: 'pointer',
            }}>
              <span style={{ fontSize: 36, marginBottom: 8 }}>📊</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {file ? file.name : '엑셀 파일을 선택하세요'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                .xlsx, .xls 형식 · 최대 10MB
              </span>
              {file && <span style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>{(file.size / 1024).toFixed(1)}KB</span>}
              <input id="file-upload" type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => handleUpload('preview')} disabled={!file || isUploading} style={{ flex: 1 }}>
              {isUploading ? '파싱 중...' : '🔍 미리보기'}
            </button>
            <button className="btn btn-success" onClick={() => handleUpload('save')} disabled={!file || isSaving} style={{ flex: 1 }}>
              {isSaving ? '저장 중...' : '💾 DB 갱신'}
            </button>
          </div>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--danger-bg)', borderRadius: 8, color: 'var(--danger)', fontSize: 13 }}>❌ {error}</div>}
        </div>

        {result && (
          <div className="card">
            <div className="card-title"><span className="icon">{result.success ? '✅' : '⚠️'}</span> {result.message}</div>
            {result.storage && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>저장소: {result.storage}</div>}
            {result.enrichment && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
                <div style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>매칭 행</div>
                  <div style={{ fontWeight: 700 }}>{fmt(result.enrichment.matchedRows)}</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>좌표 복원</div>
                  <div style={{ fontWeight: 700 }}>{fmt(result.enrichment.latLngFilled)}</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>영업제한 복원</div>
                  <div style={{ fontWeight: 700 }}>{fmt(result.enrichment.restrictionsFilled)}</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>가격 복원</div>
                  <div style={{ fontWeight: 700 }}>{fmt(result.enrichment.pricingFilled)}</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>EV 복원</div>
                  <div style={{ fontWeight: 700 }}>{fmt(result.enrichment.evFilled)}</div>
                </div>
              </div>
            )}
            {result.headers_detected && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>📋 감지된 컬럼 매핑:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {result.headers_detected.map((h, i) => (
                    <span key={i} style={{ padding: '4px 10px', background: 'var(--accent-bg)', borderRadius: 8, fontSize: 12, color: 'var(--accent)' }}>{h}</span>
                  ))}
                </div>
              </div>
            )}
            {result.preview && result.preview.length > 0 && (
              <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>No</th><th>단지명</th><th>도로명주소</th><th>구</th><th>세대수</th><th>판매수량</th><th>영업제한1</th><th>영업제한2</th></tr></thead>
                  <tbody>
                    {result.preview.map((r, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{fmt(r.name)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmt(r.addr_road)}</td>
                        <td>{fmt(r.district)}</td>
                        <td className="num">{fmt(r.households)}</td>
                        <td className="num">{fmt(r.units)}</td>
                        <td>{fmt(r.r1_industry)}</td>
                        <td>{fmt(r.r2_industry)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        <div style={{ textAlign: 'center', padding: 8, display: 'flex', gap: 16, justifyContent: 'center' }}>
          <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>← 견적봇</Link>
          <Link href="/history" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>📝 작업 로그</Link>
        </div>
      </div>
    </div>
  );
}
