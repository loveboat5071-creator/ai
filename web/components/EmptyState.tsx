'use client';

interface Props {
  isDistrictMode: boolean;
}

export default function EmptyState({ isDistrictMode }: Props) {
  const steps = [
    { step: '1', label: isDistrictMode ? '지역 선택' : '주소 입력' },
    { step: '2', label: '검색 실행' },
    { step: '3', label: '견적서 다운로드' },
  ];

  return (
    <div className="card" style={{
      minHeight: 400, display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexDirection: 'column', gap: 24, padding: 40,
    }}>
      <div style={{ fontSize: 52, opacity: 0.25 }}>{isDistrictMode ? '🗺️' : '📍'}</div>

      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          검색 결과가 여기에 표시됩니다
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {isDistrictMode
            ? '시/구 단위로 지역을 선택한 후 검색하세요.'
            : '광고를 집행할 매장 또는 상권 주소를 입력하고 검색하세요.'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        {steps.map(({ step, label }) => (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 999,
              background: 'var(--accent-bg)', color: 'var(--accent)',
              fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {step}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
            {step !== '3' && <span style={{ color: 'var(--border)', fontSize: 14 }}>→</span>}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, width: '100%', maxWidth: 360 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <div style={{ marginBottom: 4, fontWeight: 600, color: 'var(--text-secondary)' }}>검색 모드 안내</div>
          <div>📍 <b>반경 조회</b>: 특정 매장/상권 주변 단지를 모두 찾을 때</div>
          <div>🗺️ <b>지역별 조회</b>: 특정 구/시 전체를 기준으로 찾을 때</div>
        </div>
      </div>
    </div>
  );
}
