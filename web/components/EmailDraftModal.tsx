'use client';

import { useState } from 'react';
import type { EmailDraft } from '@/lib/miningTypes';

interface Props {
  draft: EmailDraft;
  recipientEmail: string;
  onClose: () => void;
}

export default function EmailDraftModal({ draft, recipientEmail, onClose }: Props) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState<'subject' | 'body' | 'all' | null>(null);

  const handleCopy = async (target: 'subject' | 'body' | 'all') => {
    const text = target === 'subject' ? subject : target === 'body' ? body : `제목: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(target);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(target);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const mailtoHref = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-white)', borderRadius: 20, width: '100%', maxWidth: 600,
        maxHeight: '85vh', overflow: 'auto', padding: '24px 28px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>✉️ 이메일 초안</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{draft.summary}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: 'var(--text-muted)', padding: 4,
            }}
          >✕</button>
        </div>

        {/* Recipient */}
        {recipientEmail && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              수신자
            </label>
            <div style={{
              padding: '8px 12px', borderRadius: 8, background: 'var(--bg-input)',
              fontSize: 13, color: '#2563eb', fontWeight: 500,
            }}>
              {recipientEmail}
            </div>
          </div>
        )}

        {/* Subject */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>제목</label>
            <button
              onClick={() => handleCopy('subject')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: copied === 'subject' ? '#059669' : 'var(--accent)',
                fontFamily: 'inherit',
              }}
            >
              {copied === 'subject' ? '✅ 복사됨' : '📋 복사'}
            </button>
          </div>
          <input
            type="text"
            className="form-input"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        </div>

        {/* Body */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>본문</label>
            <button
              onClick={() => handleCopy('body')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: copied === 'body' ? '#059669' : 'var(--accent)',
                fontFamily: 'inherit',
              }}
            >
              {copied === 'body' ? '✅ 복사됨' : '📋 복사'}
            </button>
          </div>
          <textarea
            className="form-input"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={12}
            style={{ resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={() => handleCopy('all')}
            style={{ flex: 1, fontSize: 13 }}
          >
            {copied === 'all' ? '✅ 전체 복사됨!' : '📋 전체 복사'}
          </button>
          {recipientEmail && (
            <a
              href={mailtoHref}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{
                flex: 1, fontSize: 13, textAlign: 'center', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: '#059669',
              }}
            >
              📧 메일 앱으로 보내기
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
