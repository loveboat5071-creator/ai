'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface LogEntry {
  timestamp: string;
  action: 'search' | 'search-district' | 'pdf' | 'excel' | 'telegram';
  address: string;
  radii: number[];
  resultCount?: number;
  advertiserName?: string;
  campaignName?: string;
}

const ACTION_LABELS: Record<string, { icon: string; label: string }> = {
  search: { icon: '🔍', label: '검색' },
  'search-district': { icon: '🗺️', label: '지역조회' },
  pdf: { icon: '📄', label: 'PDF' },
  excel: { icon: '📊', label: 'Excel' },
  telegram: { icon: '🤖', label: '텔레그램' },
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/logs')
      .then(r => r.json())
      .then(d => {
        setLogs(d.logs || []);
        setTotal(d.total || 0);
        setMessage(d.message || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmtTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="app-container" style={{ maxWidth: 800 }}>
      <header className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h1 onClick={() => { window.location.href = '/'; }} style={{ cursor: 'pointer', margin: 0 }}>📝 작업 로그</h1>
      </header>

      <div className="card">
        <div className="card-title">
          <span className="icon">📋</span> 사용 기록
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>총 {total}건</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>⏳ 로딩 중...</div>
        ) : message && logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{message}</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>아직 사용 기록이 없습니다.</div>
        ) : (
          <div className="table-container" style={{ maxHeight: 600, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>시간</th>
                  <th>유형</th>
                  <th>주소</th>
                  <th>반경</th>
                  <th>결과</th>
                  <th>광고주</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => {
                  const a = ACTION_LABELS[log.action] || { icon: '❓', label: log.action };
                  return (
                    <tr key={i}>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{fmtTime(log.timestamp)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{a.icon} {a.label}</td>
                      <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.address || '-'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{log.radii?.join(', ')}km</td>
                      <td className="num">{log.resultCount ?? '-'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.advertiserName || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: 12, display: 'flex', gap: 16, justifyContent: 'center' }}>
        <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>← 견적봇</Link>
        <Link href="/admin" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>⚙️ 관리자</Link>
      </div>
    </div>
  );
}
