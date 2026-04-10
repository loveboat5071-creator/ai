'use client';

import ErrorBanner from '@/components/ErrorBanner';

type SearchMode = 'radius' | 'district';
type SortBy = 'distance' | 'public_price_desc' | 'public_price_per_m2_desc' | 'rt_price_per_m2_desc';

const AVAILABLE_RADII = [0.5, 1, 1.5, 2, 3, 5];

interface Props {
  searchMode: SearchMode;
  onSearchModeChange: (m: SearchMode) => void;
  address: string;
  onAddressChange: (v: string) => void;
  selectedRadii: number[];
  onToggleRadius: (r: number) => void;
  selectedDistricts: string[];
  onToggleDistrict: (d: string) => void;
  onClearDistricts: () => void;
  districtQuery: string;
  onDistrictQueryChange: (value: string) => void;
  groupedDistricts: { city: string; districts: string[] }[];
  selectedCity: string;
  onSetSelectedCity: (c: string) => void;
  requireEvOnly: boolean;
  onRequireEvOnlyChange: (v: boolean) => void;
  sortBy: SortBy;
  onSortByChange: (v: SortBy) => void;
  advertiserName: string;
  onAdvertiserNameChange: (v: string) => void;
  campaignName: string;
  onCampaignNameChange: (v: string) => void;
  advertiserIndustry: string;
  onAdvertiserIndustryChange: (v: string) => void;
  industries: string[];
  isSearching: boolean;
  error: string;
  onDismissError: () => void;
  onSearch: () => void;
}

export default function SearchForm({
  searchMode, onSearchModeChange,
  address, onAddressChange,
  selectedRadii, onToggleRadius,
  selectedDistricts, onToggleDistrict, onClearDistricts,
  districtQuery, onDistrictQueryChange,
  groupedDistricts,
  selectedCity, onSetSelectedCity,
  requireEvOnly, onRequireEvOnlyChange,
  sortBy, onSortByChange,
  advertiserName, onAdvertiserNameChange,
  campaignName, onCampaignNameChange,
  advertiserIndustry, onAdvertiserIndustryChange,
  industries,
  isSearching,
  error, onDismissError,
  onSearch,
}: Props) {
  const isDistrictMode = searchMode === 'district';
  const trimmedDistrictQuery = districtQuery.trim();
  const districtMatches = trimmedDistrictQuery
    ? groupedDistricts
        .flatMap(g => g.districts.map(d => ({ city: g.city, district: d })))
        .filter(({ district }) => district.includes(trimmedDistrictQuery))
        .slice(0, 20)
    : [];

  return (
    <div className="card">
      {/* 검색 모드 탭 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--border)' }}>
        <button
          onClick={() => onSearchModeChange('radius')}
          style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, transition: 'all 0.15s', background: !isDistrictMode ? 'var(--accent)' : 'var(--bg-input)', color: !isDistrictMode ? '#fff' : 'var(--text-muted)' }}
        >
          📍 반경 조회
        </button>
        <button
          onClick={() => onSearchModeChange('district')}
          style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, transition: 'all 0.15s', borderLeft: '1px solid var(--border)', background: isDistrictMode ? 'var(--accent)' : 'var(--bg-input)', color: isDistrictMode ? '#fff' : 'var(--text-muted)' }}
        >
          🗺️ 지역별 조회
        </button>
      </div>

      <div className="form-grid">
        {/* 반경 조회 모드 */}
        {!isDistrictMode && (
          <>
            <div className="form-group full-width">
              <label className="form-label">기준 주소 *</label>
              <input
                className="form-input"
                type="text"
                placeholder="예: 마포구 용강동 122-1"
                value={address}
                onChange={e => onAddressChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onSearch()}
              />
            </div>
            <div className="form-group full-width">
              <label className="form-label">검색 반경 (다중 선택)</label>
              <div className="radius-chips">
                {AVAILABLE_RADII.map(r => (
                  <button key={r} className={`radius-chip ${selectedRadii.includes(r) ? 'active' : ''}`} onClick={() => onToggleRadius(r)}>
                    {r}km
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 지역별 조회 모드 */}
        {isDistrictMode && (
          <div className="form-group full-width">
            <label className="form-label">
              지역 선택 *
              {selectedDistricts.length > 0 && (
                <span style={{ color: 'var(--accent)', fontWeight: 600, marginLeft: 6 }}>({selectedDistricts.length}개)</span>
              )}
            </label>

            {selectedDistricts.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {selectedDistricts.map(d => (
                  <button
                    key={d}
                    onClick={() => onToggleDistrict(d)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {d} ✕
                  </button>
                ))}
                <button
                  onClick={onClearDistricts}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 14, padding: '3px 10px', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  전체 해제
                </button>
              </div>
            )}

            <input
              className="form-input"
              type="text"
              placeholder="구/군 이름 검색... (입력 후 클릭으로 추가)"
              value={districtQuery}
              onChange={e => onDistrictQueryChange(e.target.value)}
              style={{ marginBottom: 8 }}
            />

            {trimmedDistrictQuery && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                {districtMatches.map(({ city, district }) => (
                  <button
                    key={`${city}-${district}`}
                    onClick={() => {
                      if (!selectedDistricts.includes(district)) onToggleDistrict(district);
                      onDistrictQueryChange('');
                    }}
                    className={`radius-chip ${selectedDistricts.includes(district) ? 'active' : ''}`}
                    style={{ padding: '4px 10px', fontSize: 12 }}
                  >
                    <span style={{ opacity: 0.6, fontSize: 10 }}>{city} </span>{district}
                  </button>
                ))}
                {districtMatches.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: 4 }}>검색 결과 없음</span>
                )}
              </div>
            )}

            {!trimmedDistrictQuery && (
              <>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                  {groupedDistricts.map(g => (
                    <button
                      key={g.city}
                      onClick={() => onSetSelectedCity(g.city)}
                      style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 14, border: '1.5px solid var(--border)', cursor: 'pointer', background: selectedCity === g.city ? 'var(--accent)' : 'var(--bg-input)', color: selectedCity === g.city ? '#fff' : 'var(--text-secondary)', transition: 'all 0.15s' }}
                    >
                      {g.city} ({g.districts.length})
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                  {groupedDistricts.find(g => g.city === selectedCity)?.districts.map(d => (
                    <button
                      key={d}
                      onClick={() => onToggleDistrict(d)}
                      className={`radius-chip ${selectedDistricts.includes(d) ? 'active' : ''}`}
                      style={{ padding: '4px 12px', fontSize: 12 }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 공통 옵션 */}
        <div className="form-group">
          <label className="form-label">전기차 충전</label>
          <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--border)' }}>
            <button onClick={() => onRequireEvOnlyChange(false)} style={{ flex: 1, minHeight: 52, padding: 0, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, transition: 'all 0.15s', background: !requireEvOnly ? 'var(--accent)' : 'var(--bg-input)', color: !requireEvOnly ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              전체
            </button>
            <button onClick={() => onRequireEvOnlyChange(true)} style={{ flex: 1, minHeight: 52, padding: 0, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, transition: 'all 0.15s', borderLeft: '1px solid var(--border)', background: requireEvOnly ? 'var(--success)' : 'var(--bg-input)', color: requireEvOnly ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              충전기 O
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">정렬 기준</label>
          <select className="form-input" value={sortBy} onChange={e => onSortByChange(e.target.value as SortBy)} style={{ cursor: 'pointer', minHeight: 52, height: 52 }}>
            {!isDistrictMode && <option value="distance">거리순</option>}
            <option value="public_price_desc">공시가격 높은순</option>
            <option value="public_price_per_m2_desc">공시가격/㎡ 높은순</option>
            <option value="rt_price_per_m2_desc">실거래가/㎡ 높은순</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">광고주명</label>
          <input className="form-input" type="text" placeholder="선택사항" value={advertiserName} onChange={e => onAdvertiserNameChange(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">캠페인명</label>
          <input className="form-input" type="text" placeholder="선택사항" value={campaignName} onChange={e => onCampaignNameChange(e.target.value)} />
        </div>

        <div className="form-group full-width">
          <label className="form-label">광고주 업종 (영업제한 체크)</label>
          <select className="form-input" value={advertiserIndustry} onChange={e => onAdvertiserIndustryChange(e.target.value)} style={{ cursor: 'pointer' }}>
            <option value="">선택 안 함 (전체 가용)</option>
            {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
          </select>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>업종 선택 시 영업 제한 단지가 자동 제외됩니다.</div>
        </div>
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={onSearch} disabled={isSearching} style={{ flex: 1 }}>
          {isSearching ? <><span className="loading-spinner" /> 검색 중...</> : '🔍 검색'}
        </button>
      </div>

      {error && <ErrorBanner error={error} onDismiss={onDismissError} onRetry={onSearch} />}
    </div>
  );
}
