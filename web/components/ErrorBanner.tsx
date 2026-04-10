'use client';

interface Props {
  error: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

export default function ErrorBanner({ error, onDismiss, onRetry }: Props) {
  const isValidationError = error.includes('입력') || error.includes('선택해주세요');

  return (
    <div style={{
      marginTop: 12, padding: '10px 14px',
      background: 'rgba(239,68,68,0.1)', borderRadius: 8,
      color: 'var(--danger)', fontSize: 13,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ flex: 1 }}>{error}</span>
      {!isValidationError && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '4px 10px', borderRadius: 6,
            border: '1px solid var(--danger)', background: 'transparent',
            color: 'var(--danger)', fontSize: 12, cursor: 'pointer',
            whiteSpace: 'nowrap', fontWeight: 600,
          }}
        >
          다시 시도
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        style={{
          padding: '2px 6px', borderRadius: 4,
          border: 'none', background: 'transparent',
          color: 'var(--danger)', fontSize: 14, cursor: 'pointer', lineHeight: 1,
        }}
        aria-label="닫기"
      >
        ×
      </button>
    </div>
  );
}
