/** 단지 고유 ID 생성 (결정적: 동일 데이터 = 동일 id) */
export function makeComplexId(name: string, addrRoad?: string, addrParcel?: string): string {
  return [
    name,
    addrRoad || addrParcel || '',
  ].map(v => String(v).replace(/\s/g, '')).join('__');
}

/** 마스터 데이터 레코드 타입 */
export interface Complex {
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
  premium: string | null;
  r1_industry: string | null;
  r1_date: string | null;
  r2_industry: string | null;
  r2_date: string | null;
  public_price_median?: number | null;
  public_price_max?: number | null;
  public_price_per_m2_median?: number | null;
  public_price_sample_count?: number | null;
  public_price_base_date?: string | null;
  public_price_source?: string | null;
  public_price_match_method?: string | null;
  rt_price_per_m2_median?: number | null;
  rt_price_median?: number | null;
  rt_price_sample_count?: number | null;
  rt_price_base_period?: string | null;
  rt_price_source?: string | null;
  rt_price_match_method?: string | null;
  ev_charger_installed?: boolean;
  ev_charger_count?: number | null;
  ev_evidence_level?: 'high' | 'medium' | 'low' | null;
  ev_evidence_text?: string | null;
  ev_evidence_source?: string | null;
  ev_nearest_distance_m?: number | null;
  ev_updated_at?: string | null;
  // geocoded 좌표 (pre-processing 후)
  lat?: number;
  lng?: number;
}

export type SortBy =
  | 'distance'
  | 'public_price_desc'
  | 'public_price_per_m2_desc'
  | 'rt_price_per_m2_desc';

export type CreativeFormat = 'image' | 'video' | 'both';

export type CreativeAudioMode = 'bgm_narration' | 'bgm_only' | 'narration_only';

export type CreativeAssetKind =
  | 'store'
  | 'food'
  | 'interior'
  | 'staff'
  | 'product'
  | 'before_after'
  | 'none';

export interface CreativeBrief {
  advertiser_name?: string;
  advertiser_industry?: string;
  campaign_name?: string;
  message?: string;
  notes?: string;
  preferred_format?: CreativeFormat;
  audio_mode?: CreativeAudioMode;
  asset_kinds?: CreativeAssetKind[];
}

export interface CreativeStoryboardScene {
  title: string;
  duration_sec: number;
  visual: string;
  copy: string;
}

export interface CreativeVideoBeat {
  time_range: string;
  visual: string;
  copy: string;
}

export interface CreativePlan {
  profile_label: string;
  concept_title: string;
  concept_summary: string;
  recommended_keywords: string[];
  image_package: {
    enabled: boolean;
    composition: string;
    recommendation: string;
    source_strategy: string;
    scenes: CreativeStoryboardScene[];
  };
  video_package: {
    enabled: boolean;
    style: string;
    recommendation: string;
    beats: CreativeVideoBeat[];
  };
  audio: {
    mode: CreativeAudioMode;
    mode_label: string;
    bgm: string;
    narration_lines: string[];
  };
  required_assets: string[];
  production_checklist: string[];
  delivery_paths: {
    canva: {
      summary: string;
      steps: string[];
      master_prompt: string;
      image_scene_prompts: string[];
      video_prompt: string;
      copy_prompt: string;
    };
    internal_api: {
      summary: string;
      endpoint: string;
      method: 'POST';
      companion_endpoints: string[];
      required_fields: string[];
      outputs: string[];
    };
  };
}

/** 거리 정보가 포함된 매칭 결과 */
export interface MatchedComplex extends Complex {
  id: string;
  distance_km: number;
  radius_band: number; // 어떤 반경 밴드에 속하는지 (km)
  restriction_status: 'available' | 'restricted' | 'check_required';
}

/** 지역별 집계 결과 */
export interface RegionSummary {
  city: string;
  district: string;
  count: number;
  total_households: number;
  total_units: number;
  total_price_4w: number;
  avg_unit_price: number;
}

/** 검색 요청 */
export interface SearchRequest {
  address: string;
  lat?: number;
  lng?: number;
  radii: number[];
  districts?: string[];
  require_ev?: boolean;
  sort_by?: SortBy;
  advertiser_industry?: string;
  campaign_date?: string;
  advertiser_name?: string;
  campaign_name?: string;
}

/** 검색 응답 */
export interface SearchResponse {
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
