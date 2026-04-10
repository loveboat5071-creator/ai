'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { buildCreativePlan } from '@/lib/creativePlan';
import { sanitizeFilenameSegment } from '@/lib/escape';
import type { CreativeAssetKind } from '@/lib/types';
import EmptyState from '@/components/EmptyState';
import ComplexTable from '@/components/ComplexTable';
import ResultSummary from '@/components/ResultSummary';
import SearchForm from '@/components/SearchForm';
import CreativePlanPanel from '@/components/CreativePlanPanel';

const ResultMap = dynamic(() => import('@/components/ResultMap'), { ssr: false });

interface SearchResult {
  center: { lat: number; lng: number; address: string };
  radii: number[];
  results: MatchedComplex[];
  summaries: RegionSummary[];
  applied_filters: {
    districts: string[];
    require_ev: boolean;
    sort_by: SortBy;
  };
  total_count: number;
  total_households: number;
  total_units: number;
  total_price_4w: number;
}

type SortBy =
  | 'distance'
  | 'public_price_desc'
  | 'public_price_per_m2_desc'
  | 'rt_price_per_m2_desc';

type SearchMode = 'radius' | 'district';

interface MatchedComplex {
  id: string;
  name: string;
  city: string;
  district: string;
  dong: string;
  addr_parcel: string;
  addr_road: string;
  building_type: string;
  built_year: number | null;
  floors: number | null;
  area_pyeong: number | null;
  households: number | null;
  population: number | null;
  units: number | null;
  unit_price: number | null;
  price_4w: number | null;
  public_price_median?: number | null;
  public_price_per_m2_median?: number | null;
  rt_price_per_m2_median?: number | null;
  ev_charger_installed?: boolean;
  ev_charger_count?: number | null;
  ev_evidence_level?: 'high' | 'medium' | 'low' | null;
  ev_evidence_text?: string | null;
  distance_km: number;
  radius_band: number;
  restriction_status: string;
  lat: number;
  lng: number;
}

interface RegionSummary {
  city: string;
  district: string;
  count: number;
  total_households: number;
  total_units: number;
  total_price_4w: number;
  avg_unit_price: number;
}

const EXPORT_COLUMNS: { key: string; label: string; required?: boolean }[] = [
  { key: 'name', label: '단지명', required: true },
  { key: 'district', label: '구' },
  { key: 'dong', label: '동' },
  { key: 'addr_road', label: '주소(도로명)' },
  { key: 'building_type', label: '유형' },
  { key: 'households', label: '세대수' },
  { key: 'population', label: '인구수' },
  { key: 'built_year', label: '준공' },
  { key: 'floors', label: '층수' },
  { key: 'area_pyeong', label: '평형' },
  { key: 'units', label: '판매수량', required: true },
  { key: 'unit_price', label: '대당단가' },
  { key: 'price_4w', label: '4주 금액', required: true },
  { key: 'public_price', label: '공시가격' },
  { key: 'public_price_m2', label: '공시가/㎡' },
  { key: 'rt_price_m2', label: '실거래가/㎡' },
  { key: 'ev_charger', label: '전기차' },
  { key: 'distance', label: '거리' },
];

const DEFAULT_EXCLUDED_COLUMNS = new Set(['public_price', 'public_price_m2', 'rt_price_m2', 'ev_charger']);

export default function ProposalWorkspace() {
  const [searchMode, setSearchMode] = useState<SearchMode>('radius');
  const [advertiserName, setAdvertiserName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [advertiserIndustry, setAdvertiserIndustry] = useState('');
  const [requireEvOnly, setRequireEvOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('distance');

  const [address, setAddress] = useState('');
  const [selectedRadii, setSelectedRadii] = useState<number[]>([2]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [districtQuery, setDistrictQuery] = useState('');
  const [groupedDistricts, setGroupedDistricts] = useState<{ city: string; districts: string[] }[]>([]);
  const [selectedCity, setSelectedCity] = useState('');

  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [isGeneratingPpt, setIsGeneratingPpt] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<number | 'summary' | 'map' | 'creative'>('summary');
  const [industries, setIndustries] = useState<string[]>([]);

  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [excludedColumns, setExcludedColumns] = useState<Set<string>>(new Set(DEFAULT_EXCLUDED_COLUMNS));
  const [proposalNotes, setProposalNotes] = useState('');
  const [includeCreative, setIncludeCreative] = useState(true);
  const [creativeMessage] = useState('');
  const [creativeFormat] = useState<'both' | 'image' | 'video'>('both');
  const [creativeAudioMode] = useState<'bgm_narration' | 'bgm_only' | 'narration_only'>('bgm_narration');
  const [creativeAssetKinds] = useState<CreativeAssetKind[]>(['none']);

  useEffect(() => {
    fetch('/api/industries')
      .then(r => r.json())
      .then(d => setIndustries(d.industries || []))
      .catch(() => {});
    fetch('/api/districts')
      .then(r => r.json())
      .then(d => {
        setGroupedDistricts(d.grouped || []);
        if (d.grouped && d.grouped.length > 0) setSelectedCity(d.grouped[0].city);
      })
      .catch(() => {});
  }, []);

  const toggleExclude = (id: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleRadius = (r: number) => {
    setSelectedRadii(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r].sort((a, b) => a - b));
  };

  const toggleDistrict = (d: string) => {
    setSelectedDistricts(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const resolveDistrictQueryMatches = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    return [...new Set(
      groupedDistricts
        .flatMap(group => group.districts)
        .filter(district => district.includes(trimmed))
    )];
  }, [groupedDistricts]);

  const getVisibleList = () => {
    if (!result) return [];
    return result.results.filter(r => {
      if (r.restriction_status !== 'available') return false;
      if (!isDistrictMode && typeof activeTab === 'number' && activeTab > 0) return r.distance_km <= activeTab;
      return true;
    });
  };

  const creativePlan = buildCreativePlan({
    advertiser_name: advertiserName,
    advertiser_industry: advertiserIndustry,
    campaign_name: campaignName,
    message: creativeMessage,
    notes: proposalNotes,
    preferred_format: creativeFormat,
    audio_mode: creativeAudioMode,
    asset_kinds: creativeAssetKinds,
  });

  const handleSearch = useCallback(async () => {
    setIsSearching(true);
    setError('');
    setResult(null);
    try {
      if (searchMode === 'radius') {
        if (!address.trim()) { setError('주소를 입력해주세요.'); return; }
        if (selectedRadii.length === 0) { setError('최소 하나의 반경을 선택해주세요.'); return; }
        const geoResp = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
        const geoData = await geoResp.json();
        if (!geoResp.ok) { setError(geoData.error || '주소 변환 실패'); return; }
        const searchResp = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: geoData.lat,
            lng: geoData.lng,
            address: address.trim(),
            radii: selectedRadii,
            require_ev: requireEvOnly,
            sort_by: sortBy,
            advertiser_industry: advertiserIndustry || undefined,
            advertiser_name: advertiserName || undefined,
            campaign_name: campaignName || undefined,
          }),
        });
        const searchData = await searchResp.json();
        if (!searchResp.ok) { setError(searchData.error || '검색 실패'); return; }
        setResult(searchData);
      } else {
        let effectiveDistricts = selectedDistricts;

        if (effectiveDistricts.length === 0) {
          const matchedDistricts = resolveDistrictQueryMatches(districtQuery);
          if (matchedDistricts.length === 0) {
            setError(districtQuery.trim()
              ? `'${districtQuery.trim()}'와 일치하는 지역이 없습니다.`
              : '최소 하나의 지역을 선택해주세요.');
            return;
          }
          if (matchedDistricts.length > 1) {
            setError(`'${districtQuery.trim()}' 검색 결과가 ${matchedDistricts.length}개입니다. 아래 목록에서 하나를 선택해주세요.`);
            return;
          }
          effectiveDistricts = matchedDistricts;
          setSelectedDistricts(matchedDistricts);
          setDistrictQuery('');
        }

        const searchResp = await fetch('/api/search-district', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            districts: effectiveDistricts,
            require_ev: requireEvOnly,
            sort_by: sortBy,
            advertiser_industry: advertiserIndustry || undefined,
            advertiser_name: advertiserName || undefined,
            campaign_name: campaignName || undefined,
          }),
        });
        const searchData = await searchResp.json();
        if (!searchResp.ok) { setError(searchData.error || '검색 실패'); return; }
        setResult(searchData);
      }
      setActiveTab('summary');
      setExcludedIds(new Set());
    } catch (e) {
      setError(`오류 발생: ${e}`);
    } finally {
      setIsSearching(false);
    }
  }, [searchMode, address, selectedRadii, selectedDistricts, districtQuery, resolveDistrictQueryMatches, requireEvOnly, sortBy, advertiserIndustry, advertiserName, campaignName]);

  const handleDownload = useCallback(async () => {
    if (!result) return;
    setIsGeneratingExcel(true);
    try {
      const body: Record<string, unknown> = {
        advertiser_industry: advertiserIndustry || undefined,
        advertiser_name: advertiserName,
        campaign_name: campaignName,
        require_ev: requireEvOnly,
        sort_by: sortBy,
        excluded_ids: [...excludedIds],
        excluded_columns: [...excludedColumns],
        creative_message: creativeMessage,
        creative_asset_kinds: creativeAssetKinds,
        creative_format: creativeFormat,
        creative_audio_mode: creativeAudioMode,
      };
      if (searchMode === 'radius') {
        Object.assign(body, { lat: result.center.lat, lng: result.center.lng, address: result.center.address, radii: result.radii });
      } else {
        Object.assign(body, { districts: selectedDistricts, lat: result.center.lat || undefined, lng: result.center.lng || undefined, address: result.center.address, radii: [] });
      }
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json();
        setError(err.error || '다운로드 실패');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `포커스미디어_견적서_${sanitizeFilenameSegment(result.center.address)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`다운로드 실패: ${e}`);
    } finally {
      setIsGeneratingExcel(false);
    }
  }, [result, searchMode, selectedDistricts, requireEvOnly, sortBy, advertiserIndustry, advertiserName, campaignName, excludedIds, excludedColumns, creativeMessage, creativeAssetKinds, creativeFormat, creativeAudioMode]);

  const handlePdfPreview = useCallback(() => {
    if (!result) return;
    const params = new URLSearchParams({
      lat: String(result.center.lat),
      lng: String(result.center.lng),
      address: result.center.address,
      radii: result.radii.join(','),
      sort_by: sortBy,
      advertiser_name: advertiserName,
      campaign_name: campaignName,
    });
    if (advertiserIndustry) params.set('advertiser_industry', advertiserIndustry);
    if (selectedDistricts.length > 0) params.set('districts', selectedDistricts.join(','));
    if (requireEvOnly) params.set('require_ev', 'true');
    if (excludedIds.size > 0) params.set('excluded_ids', [...excludedIds].join(','));
    if (excludedColumns.size > 0) params.set('excluded_columns', [...excludedColumns].join(','));
    if (proposalNotes.trim()) params.set('notes', proposalNotes.trim());
    if (creativeMessage.trim()) params.set('creative_message', creativeMessage.trim());
    if (creativeAssetKinds.length > 0) params.set('creative_asset_kinds', creativeAssetKinds.join(','));
    params.set('creative_format', creativeFormat);
    params.set('creative_audio_mode', creativeAudioMode);
    if (!includeCreative) params.set('include_creative', 'false');
    window.open(`/api/pdf?${params.toString()}`, '_blank');
  }, [result, selectedDistricts, requireEvOnly, sortBy, advertiserIndustry, advertiserName, campaignName, excludedIds, excludedColumns, proposalNotes, creativeMessage, creativeAssetKinds, creativeFormat, creativeAudioMode, includeCreative]);

  const handlePptDownload = useCallback(async () => {
    if (!result) return;
    setIsGeneratingPpt(true);
    try {
      const body: Record<string, unknown> = {
        advertiser_industry: advertiserIndustry || undefined,
        advertiser_name: advertiserName,
        campaign_name: campaignName,
        require_ev: requireEvOnly,
        sort_by: sortBy,
        excluded_ids: [...excludedIds],
        excluded_columns: [...excludedColumns],
        notes: proposalNotes,
        creative_message: creativeMessage,
        creative_asset_kinds: creativeAssetKinds,
        creative_format: creativeFormat,
        creative_audio_mode: creativeAudioMode,
        include_creative: includeCreative,
      };
      if (searchMode === 'radius') {
        Object.assign(body, { lat: result.center.lat, lng: result.center.lng, address: result.center.address, radii: result.radii });
      } else {
        Object.assign(body, { districts: selectedDistricts, lat: result.center.lat || undefined, lng: result.center.lng || undefined, address: result.center.address, radii: [] });
      }
      const resp = await fetch('/api/ppt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json();
        setError(err.error || 'PPT 다운로드 실패');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `포커스미디어_견적서_${sanitizeFilenameSegment(result.center.address)}_${new Date().toISOString().slice(0, 10)}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`PPT 다운로드 실패: ${e}`);
    } finally {
      setIsGeneratingPpt(false);
    }
  }, [result, searchMode, selectedDistricts, requireEvOnly, sortBy, advertiserIndustry, advertiserName, campaignName, excludedIds, excludedColumns, proposalNotes, creativeMessage, creativeAssetKinds, creativeFormat, creativeAudioMode, includeCreative]);

  const fmt = (n: number | null | undefined) => n != null ? n.toLocaleString('ko-KR') : '-';
  const isDistrictMode = searchMode === 'district';

  return (
    <div className="main-grid">
      <div className="sidebar">
        <SearchForm
          searchMode={searchMode}
          onSearchModeChange={setSearchMode}
          address={address}
          onAddressChange={setAddress}
          selectedRadii={selectedRadii}
          onToggleRadius={toggleRadius}
          selectedDistricts={selectedDistricts}
          onToggleDistrict={toggleDistrict}
          onClearDistricts={() => setSelectedDistricts([])}
          districtQuery={districtQuery}
          onDistrictQueryChange={setDistrictQuery}
          groupedDistricts={groupedDistricts}
          selectedCity={selectedCity}
          onSetSelectedCity={setSelectedCity}
          requireEvOnly={requireEvOnly}
          onRequireEvOnlyChange={setRequireEvOnly}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          advertiserName={advertiserName}
          onAdvertiserNameChange={setAdvertiserName}
          campaignName={campaignName}
          onCampaignNameChange={setCampaignName}
          advertiserIndustry={advertiserIndustry}
          onAdvertiserIndustryChange={setAdvertiserIndustry}
          industries={industries}
          isSearching={isSearching}
          error={error}
          onDismissError={() => setError('')}
          onSearch={handleSearch}
        />

        {result ? (
          <ResultSummary
            result={result}
            exportColumns={EXPORT_COLUMNS}
            excludedColumns={excludedColumns}
            onToggleColumn={(key) => setExcludedColumns(prev => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key); else next.add(key);
              return next;
            })}
            includeCreative={includeCreative}
            onIncludeCreativeChange={setIncludeCreative}
            proposalNotes={proposalNotes}
            onProposalNotesChange={setProposalNotes}
            isGeneratingExcel={isGeneratingExcel}
            isGeneratingPpt={isGeneratingPpt}
            onDownloadExcel={handleDownload}
            onDownloadPpt={handlePptDownload}
            onPreviewPdf={handlePdfPreview}
          />
        ) : null}
      </div>

      <div>
        {!result ? (
          <EmptyState isDistrictMode={isDistrictMode} />
        ) : (
          <div className="card results-section">
            <div className="tabs">
              <button className={`tab ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>📋 요약</button>
              <button className={`tab ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>🗺️ 지도</button>
              <button className={`tab ${activeTab === 'creative' ? 'active' : ''}`} onClick={() => setActiveTab('creative')}>🎬 소재기획</button>
              {result.radii.length > 0 ? (
                result.radii.map(r => (
                  <button key={r} className={`tab ${activeTab === r ? 'active' : ''}`} onClick={() => setActiveTab(r)}>
                    📍 {r}km ({result.results.filter(x => x.distance_km <= r && x.restriction_status === 'available').length}건)
                  </button>
                ))
              ) : (
                <button className={`tab ${activeTab === 0 ? 'active' : ''}`} onClick={() => setActiveTab(0)}>
                  📋 전체 리스트 ({result.total_count}건)
                </button>
              )}
            </div>

            {activeTab === 'summary' && (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>타겟(시/구)</th>
                      <th className="num">가동 수</th>
                      <th className="num">세대 수</th>
                      <th className="num">대당단가</th>
                      <th className="num">4주 금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.summaries.map((s, i) => (
                      <tr key={i}>
                        <td>{s.city.replace(/특별시|광역시/g, '')} {s.district}</td>
                        <td className="num">{fmt(s.total_units)}</td>
                        <td className="num">{fmt(s.total_households)}</td>
                        <td className="num">{fmt(s.avg_unit_price)}</td>
                        <td className="num">{fmt(s.total_price_4w)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'rgba(99,102,241,0.08)', fontWeight: 600 }}>
                      <td>합계</td>
                      <td className="num">{fmt(result.total_units)}</td>
                      <td className="num">{fmt(result.total_households)}</td>
                      <td className="num">-</td>
                      <td className="num">{fmt(result.total_price_4w)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'map' && (
              <ResultMap
                center={result.center}
                complexes={result.results.filter(r => r.restriction_status === 'available')}
                radii={result.radii}
                activeRadius={result.radii.length > 0 ? Math.max(...result.radii) : 0}
              />
            )}

            {activeTab === 'creative' && (
              <CreativePlanPanel creativePlan={creativePlan} creativeFormat={creativeFormat} />
            )}

            {typeof activeTab === 'number' && (
              <ComplexTable
                complexes={getVisibleList()}
                excludedIds={excludedIds}
                onToggle={toggleExclude}
                onResetExcluded={() => setExcludedIds(new Set())}
                onToggleAll={(exclude) => {
                  const list = getVisibleList();
                  if (exclude) {
                    setExcludedIds(prev => {
                      const next = new Set(prev);
                      list.forEach(c => next.add(c.id));
                      return next;
                    });
                  } else {
                    setExcludedIds(prev => {
                      const next = new Set(prev);
                      list.forEach(c => next.delete(c.id));
                      return next;
                    });
                  }
                }}
                isDistrictMode={isDistrictMode}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
