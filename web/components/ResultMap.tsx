'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { escapeHtml } from '@/lib/escape';

interface MapComplex {
  name: string;
  addr_road: string;
  district: string;
  dong: string;
  lat: number;
  lng: number;
  households: number | null;
  units: number | null;
  price_4w: number | null;
  distance_km: number;
}

interface ResultMapProps {
  center: { lat: number; lng: number };
  complexes: MapComplex[];
  radii: number[];
  activeRadius: number;
}

type KakaoLatLng = { readonly _kakaoLatLng: true };
type KakaoMarker = { readonly _kakaoMarker: true };
type KakaoMarkerImage = { readonly _kakaoMarkerImage: true };
type KakaoSize = { readonly _kakaoSize: true };
type KakaoControl = { readonly _kakaoControl: true };

interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void;
}

interface KakaoMap {
  addControl(control: KakaoControl, position: number): void;
  setBounds(bounds: KakaoLatLngBounds): void;
}

interface KakaoInfoWindow {
  open(map: KakaoMap, marker: KakaoMarker): void;
}

interface KakaoMapsAPI {
  load(callback: () => void): void;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Circle: new (options: {
    center: KakaoLatLng;
    radius: number;
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    strokeStyle: string;
    fillColor: string;
    fillOpacity: number;
  }) => { setMap(map: KakaoMap): void };
  Marker: new (options: {
    position: KakaoLatLng;
    map: KakaoMap;
    image?: KakaoMarkerImage;
    title?: string;
  }) => KakaoMarker;
  InfoWindow: new (options: { content: string }) => KakaoInfoWindow;
  ZoomControl: new () => KakaoControl;
  ControlPosition: { RIGHT: number };
  event: { addListener(target: KakaoMarker, type: string, handler: () => void): void };
  MarkerImage: new (src: string, size: KakaoSize) => KakaoMarkerImage;
  Size: new (width: number, height: number) => KakaoSize;
  LatLngBounds: new (...args: [] | [KakaoLatLng, KakaoLatLng]) => KakaoLatLngBounds;
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsAPI };
  }
}

type MapHandle = { remove?: () => void } | KakaoMap;

export default function ResultMap({ center, complexes, radii, activeRadius }: ResultMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapHandle | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearMap = useEffectEvent(() => {
    const current = mapInstanceRef.current;
    if (current && 'remove' in current && typeof current.remove === 'function') {
      current.remove();
    }
    mapInstanceRef.current = null;
  });

  const initKakaoMap = useEffectEvent((maps: KakaoMapsAPI) => {
    if (!mapRef.current) return;

    mapRef.current.innerHTML = '';
    const hasCenter = center.lat !== 0 || center.lng !== 0;

    const mapCenter = hasCenter
      ? new maps.LatLng(center.lat, center.lng)
      : new maps.LatLng(37.5665, 126.978);
    const map = new maps.Map(mapRef.current, {
      center: mapCenter,
      level: hasCenter ? getKakaoZoomLevel(activeRadius) : 10,
    });

    map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);

    // 반경 원 (반경 모드만)
    if (hasCenter && radii.length > 0) {
      const sortedRadii = [...radii].sort((a, b) => a - b);
      const colors = ['#3182f6', '#00c471', '#f59e0b', '#f04452', '#8b5cf6', '#06b6d4'];
      sortedRadii.forEach((radius, index) => {
        new maps.Circle({
          center: mapCenter,
          radius: radius * 1000,
          strokeWeight: 2,
          strokeColor: colors[index % colors.length],
          strokeOpacity: 0.8,
          strokeStyle: 'dash',
          fillColor: colors[index % colors.length],
          fillOpacity: 0.05,
        }).setMap(map);
      });

      // 중심 마커
      const centerMarker = new maps.Marker({ position: mapCenter, map });
      const centerInfoWindow = new maps.InfoWindow({
        content: '<div style="padding:5px 10px;font-size:12px;font-weight:700;">📍 기준 위치</div>',
      });
      maps.event.addListener(centerMarker, 'click', () => {
        centerInfoWindow.open(map, centerMarker);
      });
    }

    const filtered = complexes.filter((complex) => {
      if (!complex.lat || !complex.lng) return false;
      if (activeRadius > 0) return complex.distance_km <= activeRadius;
      return true; // 지역별 모드: 전체
    });
    const fmt = (value: number | null) => value != null ? value.toLocaleString('ko-KR') : '-';

    const markerImage = new maps.MarkerImage(
      'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
      new maps.Size(24, 35)
    );

    const bounds = new maps.LatLngBounds();

    filtered.forEach((complex) => {
      const pos = new maps.LatLng(complex.lat, complex.lng);
      bounds.extend(pos);

      const marker = new maps.Marker({
        position: pos, map, image: markerImage, title: complex.name,
      });

      const safeAddress = escapeHtml(complex.addr_road || `${complex.district} ${complex.dong}`);
      const safeName = escapeHtml(complex.name);
      const distLine = complex.distance_km > 0 ? `거리: <strong>${complex.distance_km.toFixed(2)}km</strong>` : '';
      const infoContent = `
        <div style="padding:8px 12px;font-family:'Noto Sans KR',sans-serif;font-size:12px;line-height:1.6;min-width:200px;max-width:280px;">
          <strong style="font-size:13px;">${safeName}</strong><br>
          <span style="color:#4e5968;font-size:11px;">${safeAddress}</span><br>
          <hr style="margin:4px 0;border:none;border-top:1px solid #eee;">
          세대수: <strong>${fmt(complex.households)}</strong> &nbsp;|&nbsp;
          판매: <strong>${fmt(complex.units)}대</strong><br>
          4주 금액: <strong>${fmt(complex.price_4w)}원</strong>
          ${distLine ? '<br>' + distLine : ''}
        </div>
      `;

      const infoWindow = new maps.InfoWindow({ content: infoContent });
      maps.event.addListener(marker, 'click', () => {
        infoWindow.open(map, marker);
      });
    });

    if (hasCenter && radii.length > 0) {
      // 반경 모드: 반경 원 기준 bounds
      const maxRadius = Math.max(...radii);
      const latDelta = maxRadius / 111;
      const lngDelta = maxRadius / (111 * Math.cos(center.lat * Math.PI / 180));
      bounds.extend(new maps.LatLng(center.lat - latDelta, center.lng - lngDelta));
      bounds.extend(new maps.LatLng(center.lat + latDelta, center.lng + lngDelta));
    }
    // 마커 기반 auto-fit
    if (filtered.length > 0) {
      map.setBounds(bounds);
    }

    mapInstanceRef.current = map;
    setIsLoaded(true);
  });

  const loadLeafletMap = useEffectEvent(async () => {
    if (!mapRef.current) return;
    const hasCenter = center.lat !== 0 || center.lng !== 0;

    try {
      const L = (await import('leaflet')).default;
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      mapRef.current.innerHTML = '';

      const map = L.map(mapRef.current, {
        center: hasCenter ? [center.lat, center.lng] : [37.5665, 126.978],
        zoom: hasCenter ? 14 : 10,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      if (hasCenter && radii.length > 0) {
        const sortedRadii = [...radii].sort((a, b) => a - b);
        const colors = ['#3182f6', '#00c471', '#f59e0b', '#f04452', '#8b5cf6', '#06b6d4'];
        sortedRadii.forEach((radius, index) => {
          L.circle([center.lat, center.lng], {
            radius: radius * 1000,
            color: colors[index % colors.length],
            fillColor: colors[index % colors.length],
            fillOpacity: 0.04,
            weight: 1.5,
            dashArray: '6 4',
          }).addTo(map);
        });

        const centerIcon = L.divIcon({
          html: `<div style="width:32px;height:32px;background:#3182f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
            <span style="color:white;font-size:14px">📍</span></div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        L.marker([center.lat, center.lng], { icon: centerIcon })
          .bindPopup('<strong>기준 위치</strong>')
          .addTo(map);
      }

      const filtered = complexes.filter((complex) => {
        if (!complex.lat || !complex.lng) return false;
        if (activeRadius > 0) return complex.distance_km <= activeRadius;
        return true;
      });
      const fmt = (value: number | null) => value != null ? value.toLocaleString('ko-KR') : '-';
      const boundsGroup = L.featureGroup();

      filtered.forEach((complex) => {
        const markerIcon = L.divIcon({
          html: `<div style="width:24px;height:24px;background:#00c471;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.2);font-size:10px;color:white;font-weight:700;display:flex;align-items:center;justify-content:center;">${complex.units || ''}</div>`,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const safeName = escapeHtml(complex.name);
        const safeAddress = escapeHtml(complex.addr_road || `${complex.district} ${complex.dong}`);
        const distLine = complex.distance_km > 0 ? `<br>거리: <strong>${complex.distance_km.toFixed(2)}km</strong>` : '';

        const m = L.marker([complex.lat, complex.lng], { icon: markerIcon })
          .bindPopup(`
            <div style="font-family:'Noto Sans KR',sans-serif;font-size:12px;line-height:1.6;min-width:180px;">
              <strong style="font-size:13px;">${safeName}</strong><br>
              <span style="color:#4e5968;font-size:11px;">${safeAddress}</span><br>
              <hr style="margin:4px 0;border:none;border-top:1px solid #eee;">
              세대수: <strong>${fmt(complex.households)}</strong> &nbsp;|&nbsp;
              판매: <strong>${fmt(complex.units)}대</strong><br>
              4주 금액: <strong>${fmt(complex.price_4w)}원</strong>
              ${distLine}
            </div>
          `)
          .addTo(map);
        boundsGroup.addLayer(m);
      });

      if (hasCenter && activeRadius > 0) {
        map.fitBounds(L.latLng(center.lat, center.lng).toBounds(activeRadius * 2000), { padding: [20, 20] });
      } else if (filtered.length > 0) {
        map.fitBounds(boundsGroup.getBounds(), { padding: [30, 30] });
      }
      mapInstanceRef.current = map;
      setIsLoaded(true);
    } catch (loadError) {
      setError('지도 로드 실패');
      console.error(loadError);
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    setIsLoaded(false);
    setError(null);
    clearMap();

    const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!jsKey) {
      void loadLeafletMap();
      return () => clearMap();
    }

    if (window.kakao?.maps) {
      initKakaoMap(window.kakao.maps);
      return () => clearMap();
    }

    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false`;
    script.onload = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        void loadLeafletMap();
        return;
      }
      maps.load(() => initKakaoMap(maps));
    };
    script.onerror = () => {
      console.warn('Kakao Maps 로드 실패, Leaflet 폴백');
      void loadLeafletMap();
    };
    document.head.appendChild(script);

    return () => {
      script.remove();
      clearMap();
    };
  }, [activeRadius, center.lat, center.lng, complexes, radii]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: 450,
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      />
      {!isLoaded && !error && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-input)',
          borderRadius: 14,
          color: 'var(--text-muted)',
        }}>
          🗺️ 지도 로딩 중...
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-input)',
          borderRadius: 14,
          color: 'var(--text-muted)',
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

function getKakaoZoomLevel(radius: number): number {
  if (radius <= 0.5) return 5;
  if (radius <= 1) return 6;
  if (radius <= 1.5) return 7;
  if (radius <= 2) return 7;
  if (radius <= 3) return 8;
  if (radius <= 5) return 9;
  return 10;
}
