'use client';

import { useCallback, useState } from 'react';
import MiningResultList from '@/components/MiningResultList';
import MiningSearchForm from '@/components/MiningSearchForm';
import type { MinedBusiness, MiningSearchMode, MiningSearchResponse } from '@/lib/miningTypes';

const MINING_KEY = process.env.NEXT_PUBLIC_MINING_API_KEY || '';

export default function MiningWorkspace() {
  const [miningRegion, setMiningRegion] = useState('');
  const [miningCategory, setMiningCategory] = useState('');
  const [miningSearchMode, setMiningSearchMode] = useState<MiningSearchMode>('category');
  const [miningCategoryGroupCode, setMiningCategoryGroupCode] = useState('');
  const [miningBusinesses, setMiningBusinesses] = useState<MinedBusiness[]>([]);
  const [miningPage, setMiningPage] = useState(1);
  const [miningHasMore, setMiningHasMore] = useState(false);
  const [miningTotalCount, setMiningTotalCount] = useState<number | null>(null);
  const [isMiningSearching, setIsMiningSearching] = useState(false);
  const [isSendingToServer, setIsSendingToServer] = useState(false);
  const [miningError, setMiningError] = useState('');
  const [miningExcludedIds, setMiningExcludedIds] = useState<Set<string>>(new Set());
  const [miningActiveTab, setMiningActiveTab] = useState<'list' | 'map'>('list');
  const [miningEmailOnly, setMiningEmailOnly] = useState(true);
  const [isMiningEnriching, setIsMiningEnriching] = useState(false);

  const handleMiningSearch = useCallback(async (pageNum?: number) => {
    const targetPage = pageNum || 1;
    if (!miningRegion.trim()) {
      setMiningError('지역을 입력해주세요.');
      return;
    }
    if (miningSearchMode === 'keyword' && !miningCategory.trim()) {
      setMiningError('업종 키워드를 입력해주세요.');
      return;
    }
    if (miningSearchMode === 'category' && !miningCategoryGroupCode) {
      setMiningError('카테고리를 선택해주세요.');
      return;
    }
    setIsMiningSearching(true);
    setMiningError('');
    if (targetPage === 1) {
      setMiningBusinesses([]);
      setMiningExcludedIds(new Set());
    }
    try {
      const resp = await fetch('/api/mining/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Mining-Key': MINING_KEY },
        body: JSON.stringify({
          region: miningRegion.trim(),
          category: miningSearchMode === 'keyword' ? miningCategory.trim() : undefined,
          categoryGroupCode: miningSearchMode === 'category' ? miningCategoryGroupCode : undefined,
          searchMode: miningSearchMode,
          page: targetPage,
        }),
      });
      const data: MiningSearchResponse = await resp.json();
      if (!data.success) throw new Error(data.error || 'Search failed');
      const newBusinesses = data.businesses;
      setMiningBusinesses(prev => {
        if (targetPage === 1) return newBusinesses;
        const existingIds = new Set(prev.map(b => b.id));
        const newBiz = newBusinesses.filter(b => !existingIds.has(b.id));
        return [...prev, ...newBiz];
      });
      setMiningPage(data.page);
      setMiningHasMore(data.hasMore);
      setMiningTotalCount(data.totalCount);

      if (newBusinesses.length > 0) {
        setIsMiningEnriching(true);
        const BATCH_SIZE = 10;
        const batches: typeof newBusinesses[] = [];
        for (let i = 0; i < newBusinesses.length; i += BATCH_SIZE) {
          batches.push(newBusinesses.slice(i, i + BATCH_SIZE));
        }

        (async () => {
          try {
            for (const batch of batches) {
              try {
                const enrichResp = await fetch('/api/mining/enrich', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-Mining-Key': MINING_KEY },
                  body: JSON.stringify({
                    region: miningRegion.trim(),
                    businesses: batch.map(b => ({ placeId: b.id, name: b.name })),
                  }),
                });
                const enrichData = await enrichResp.json();
                if (enrichData.success && enrichData.results) {
                  const enrichMap = new Map(
                    enrichData.results.map((r: { placeId: string; homepageUrl: string | null; emails: string[] }) => [r.placeId, r]),
                  );
                  setMiningBusinesses(prev =>
                    prev.map(b => {
                      const enriched = enrichMap.get(b.id) as { homepageUrl: string | null; emails: string[] } | undefined;
                      if (!enriched) return b;
                      return {
                        ...b,
                        homepageUrl: enriched.homepageUrl || null,
                        emails: enriched.emails.length > 0 ? enriched.emails : b.emails,
                      };
                    }),
                  );
                }
              } catch {
                // continue with next batch
              }
            }
          } finally {
            setIsMiningEnriching(false);
            setIsMiningSearching(false);
          }
        })();
      } else {
        setIsMiningSearching(false);
      }
    } catch (e) {
      setMiningError(e instanceof Error ? e.message : String(e));
      setIsMiningSearching(false);
    }
  }, [miningRegion, miningCategory, miningSearchMode, miningCategoryGroupCode]);

  const toggleMiningExclude = (id: string) => {
    setMiningExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSendToServer = useCallback(async () => {
    const selected = miningBusinesses.filter(b => !miningExcludedIds.has(b.id));
    if (selected.length === 0) return;
    setIsSendingToServer(true);
    setMiningError('');
    try {
      const resp = await fetch('/api/mining/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Mining-Key': MINING_KEY },
        body: JSON.stringify({
          region: miningRegion,
          category: miningCategory,
          businesses: selected,
        }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'Send failed');
      alert(`✅ ${selected.length}건의 광고주 후보가 서버로 전송되었습니다.`);
    } catch (e) {
      setMiningError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSendingToServer(false);
    }
  }, [miningBusinesses, miningExcludedIds, miningRegion, miningCategory]);

  const filteredMiningBusinesses = miningEmailOnly
    ? miningBusinesses.filter(b => b.emails && b.emails.length > 0)
    : miningBusinesses;

  return (
    <div className="main-grid">
      <div className="sidebar">
        <MiningSearchForm
          region={miningRegion}
          onRegionChange={setMiningRegion}
          category={miningCategory}
          onCategoryChange={setMiningCategory}
          searchMode={miningSearchMode}
          onSearchModeChange={setMiningSearchMode}
          categoryGroupCode={miningCategoryGroupCode}
          onCategoryGroupCodeChange={setMiningCategoryGroupCode}
          isSearching={isMiningSearching}
          onSearch={() => handleMiningSearch(1)}
          error={miningError}
          onDismissError={() => setMiningError('')}
          totalCount={miningTotalCount}
          isEnriching={isMiningEnriching}
        />
      </div>

      <div>
        <div className="card results-section" style={{ padding: 24, borderRadius: 20 }}>
          <div className="tabs" style={{ marginBottom: 16, padding: 4 }}>
            <button className={`tab ${miningActiveTab === 'list' ? 'active' : ''}`} onClick={() => setMiningActiveTab('list')}>📋 리스트</button>
            <button className={`tab ${miningActiveTab === 'map' ? 'active' : ''}`} onClick={() => setMiningActiveTab('map')}>🗺️ 지도</button>
            <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: miningEmailOnly ? 'var(--accent)' : 'var(--text-secondary)' }}>
              <input type="checkbox" checked={miningEmailOnly} onChange={e => setMiningEmailOnly(e.target.checked)} style={{ cursor: 'pointer' }} />
              📧 이메일 있는 업체만
            </label>
          </div>

          {miningActiveTab === 'list' ? (
            <MiningResultList
              businesses={filteredMiningBusinesses}
              excludedIds={miningExcludedIds}
              onToggle={toggleMiningExclude}
              onToggleAll={(exclude) => {
                if (exclude) {
                  setMiningExcludedIds(new Set(filteredMiningBusinesses.map(b => b.id)));
                } else {
                  setMiningExcludedIds(new Set());
                }
              }}
              onResetExcluded={() => setMiningExcludedIds(new Set())}
              page={miningPage}
              hasMore={miningHasMore}
              totalCount={miningTotalCount}
              onNextPage={() => handleMiningSearch(miningPage + 1)}
              onPrevPage={() => handleMiningSearch(Math.max(1, miningPage - 1))}
              isLoading={isMiningSearching}
              isSending={isSendingToServer}
              onSendToServer={handleSendToServer}
            />
          ) : (
            <div style={{ position: 'relative' }}>
              {miningBusinesses.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  ← 검색 후 지도에서 업체 위치를 확인할 수 있습니다.
                </div>
              ) : (
                <div id="mining-map" style={{ width: '100%', height: 500, borderRadius: 12, overflow: 'hidden' }} ref={(el) => {
                  if (!el || typeof window === 'undefined') return;
                  const loadMap = () => {
                    const kakao = (window as unknown as Record<string, unknown>).kakao as {
                      maps: {
                        load: (fn: () => void) => void;
                        LatLng: new (lat: number, lng: number) => unknown;
                        Map: new (el: HTMLElement, opts: Record<string, unknown>) => { setCenter: (pos: unknown) => void; setBounds: (bounds: unknown) => void };
                        Marker: new (opts: Record<string, unknown>) => unknown;
                        InfoWindow: new (opts: Record<string, unknown>) => { open: (map: unknown, marker: unknown) => void; close: () => void };
                        LatLngBounds: new () => { extend: (pos: unknown) => void };
                      };
                    } | undefined;
                    if (!kakao?.maps) return;
                    kakao.maps.load(() => {
                      const center = new kakao.maps.LatLng(miningBusinesses[0].lat, miningBusinesses[0].lng);
                      const map = new kakao.maps.Map(el, { center, level: 5 });
                      const bounds = new kakao.maps.LatLngBounds();
                      miningBusinesses.forEach((b) => {
                        const pos = new kakao.maps.LatLng(b.lat, b.lng);
                        bounds.extend(pos);
                        const marker = new kakao.maps.Marker({ map, position: pos });
                        const infowindow = new kakao.maps.InfoWindow({
                          content: `<div style="padding:4px 8px;font-size:12px;white-space:nowrap">${b.name}</div>`,
                        });
                        (marker as unknown as { addListener: (event: string, fn: () => void) => void }).addListener('mouseover', () => infowindow.open(map, marker));
                        (marker as unknown as { addListener: (event: string, fn: () => void) => void }).addListener('mouseout', () => infowindow.close());
                      });
                      if (miningBusinesses.length > 1) map.setBounds(bounds);
                    });
                  };
                  if ((window as unknown as Record<string, unknown>).kakao) {
                    loadMap();
                  } else {
                    const script = document.createElement('script');
                    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY || ''}&autoload=false`;
                    script.onload = loadMap;
                    document.head.appendChild(script);
                  }
                }} />
              )}
              {miningBusinesses.length > 0 ? (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                  📍 {miningBusinesses.length}개 업체 표시 중
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
