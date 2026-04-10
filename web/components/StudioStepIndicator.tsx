'use client';

interface Step {
  key: string;
  title: string;
  done: boolean;
}

interface Props {
  steps: Step[];
}

export default function StudioStepIndicator({ steps }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 0 4px', overflowX: 'auto' }}>
      {steps.map((step, index) => (
        <div
          key={step.key}
          style={{
            display: 'flex', alignItems: 'center',
            flex: index < steps.length - 1 ? 1 : 'initial',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 999, flexShrink: 0,
              background: step.done ? 'var(--success)' : 'var(--accent-bg)',
              color: step.done ? '#fff' : 'var(--accent)',
              border: step.done ? 'none' : '1.5px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>
              {step.done ? '✓' : index + 1}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: step.done ? 'var(--success)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {step.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {step.done ? '완료' : '진행 전'}
              </div>
            </div>
          </div>
          {index < steps.length - 1 && (
            <div style={{
              flex: 1, height: 2, margin: '0 10px',
              background: step.done ? 'var(--success)' : 'var(--border)',
              borderRadius: 1, minWidth: 20,
            }} />
          )}
        </div>
      ))}
    </div>
  );
}
