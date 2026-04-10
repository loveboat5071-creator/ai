'use client';

interface MatchedComplex {
  id: string;
  name: string;
  city: string;
  district: string;
  dong: string;
  addr_road: string;
  households: number | null;
  units: number | null;
  unit_price: number | null;
  price_4w: number | null;
  public_price_median?: number | null;
  public_price_per_m2_median?: number | null;
  rt_price_per_m2_median?: number | null;
  ev_charger_installed?: boolean;
  ev_evidence_level?: 'high' | 'medium' | 'low' | null;
  ev_evidence_text?: string | null;
  distance_km: number;
  restriction_status: string;
}

interface Props {
  complexes: MatchedComplex[];
  excludedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (exclude: boolean) => void;
  onResetExcluded: () => void;
  isDistrictMode: boolean;
}

function fmt(v: number | null | undefined): string {
  if (v == null) return '-';
  return v.toLocaleString('ko-KR');
}

function fmtM(v: number | null | undefined): string {
  if (v == null) return '-';
  return (v / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + '만';
}

export default function ComplexTable({ complexes, excludedIds, onToggle, onToggleAll, onResetExcluded, isDistrictMode }: Props) {
  const selectedCount = complexes.filter(c => !excludedIds.has(c.id)).length;
  const allChecked = selectedCount === complexes.length;

  return (
    <div className="table-container" style={{ maxHeight: 600, overflowY: 'auto' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
        padding: '6px 12px', background: 'var(--bg-input)', borderRadius: 8, fontSize: 13,
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={allChecked}
            onChange={() => onToggleAll(allChecked)}
            style={{ cursor: 'pointer' }}
          />
          전체 선택
        </label>
        <span style={{ color: 'var(--text-muted)' }}>
          {selectedCount}/{complexes.length}건 선택
          {excludedIds.size > 0 && (
            <button
              onClick={onResetExcluded}
              style={{
                marginLeft: 8, background: 'none', border: 'none',
                color: 'var(--accent)', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, textDecoration: 'underline',
              }}
            >
              제외 초기화
            </button>
          )}
        </span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>☑</th>
            <th>No</th>
            <th>단지명</th>
            <th>주소(도로명)</th>
            <th>구</th>
            <th>동</th>
            <th className="num">세대수</th>
            <th className="num">판매수량</th>
            <th className="num">대당단가</th>
            <th className="num">4주 금액</th>
            <th className="num">공시가격</th>
            <th className="num">공시가/㎡</th>
            <th className="num">실거래가/㎡</th>
            <th>전기차</th>
            {!isDistrictMode && <th className="num">거리</th>}
          </tr>
        </thead>
        <tbody>
          {complexes.map((c, i) => {
            const isExcluded = excludedIds.has(c.id);
            return (
              <tr key={c.id} className={isExcluded ? 'row-excluded' : undefined}>
                <td>
                  <input
                    type="checkbox"
                    checked={!isExcluded}
                    onChange={() => onToggle(c.id)}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {c.addr_road}
                </td>
                <td>{c.district}</td>
                <td>{c.dong}</td>
                <td className="num">{fmt(c.households)}</td>
                <td className="num">{fmt(c.units)}</td>
                <td className="num">{fmt(c.unit_price)}</td>
                <td className="num">{fmt(c.price_4w)}</td>
                <td className="num">{fmtM(c.public_price_median)}</td>
                <td className="num">{fmtM(c.public_price_per_m2_median)}</td>
                <td className="num">{fmtM(c.rt_price_per_m2_median)}</td>
                <td>
                  {c.ev_charger_installed ? (
                    <span className="badge badge-success" title={c.ev_evidence_text || undefined}>설치</span>
                  ) : c.ev_evidence_level === 'low' ? (
                    <span
                      className="badge"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}
                      title={c.ev_evidence_text || undefined}
                    >
                      근접
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                  )}
                </td>
                {!isDistrictMode && <td className="num">{c.distance_km.toFixed(2)}km</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
