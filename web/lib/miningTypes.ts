/**
 * 광고주 마이닝 타입 정의
 */

export type MiningSearchMode = 'category' | 'keyword';

/** 카카오맵에서 검색된 업체 정보 */
export interface MinedBusiness {
  id: string;
  name: string;
  category: string;
  categoryGroup: string;
  phone: string;
  address: string;
  addressJibun: string;
  lat: number;
  lng: number;
  placeUrl: string;
  homepageUrl: string | null;
  emails: string[];
  status: 'pending' | 'crawled' | 'drafted' | 'skipped';
}

/** 크롤링 결과 (홈페이지 enrichment) */
export interface CrawlEnrichment {
  emails: string[];
  phones: string[];
  title: string | null;
  description: string | null;
  companyOverview: string | null;
  keyServices: string[];
  keyMessages: string[];
  contactConfidence: 'LOW' | 'MEDIUM' | 'HIGH';
  pagesCrawled: number;
  primaryEmail: string | null;
  primaryPhone: string | null;
}

/** 이메일 초안 */
export interface EmailDraft {
  subject: string;
  body: string;
  summary: string;
}

/** 마이닝 검색 응답 */
export interface MiningSearchResponse {
  success: boolean;
  businesses: MinedBusiness[];
  totalCount: number;
  page: number;
  hasMore: boolean;
  region: string;
  category: string;
  error?: string;
}

/** 카카오 카테고리 그룹 코드 */
export const CATEGORY_GROUP_CODES: { code: string; label: string }[] = [
  { code: 'HP8', label: '병원' },
  { code: 'PM9', label: '약국' },
  { code: 'FD6', label: '음식점' },
  { code: 'CE7', label: '카페' },
  { code: 'MT1', label: '대형마트' },
  { code: 'CS2', label: '편의점' },
  { code: 'BK9', label: '은행' },
  { code: 'AG2', label: '부동산' },
  { code: 'OL7', label: '주유소' },
  { code: 'CT1', label: '문화시설' },
  { code: 'AT4', label: '관광명소' },
  { code: 'AD5', label: '숙박' },
  { code: 'SC4', label: '학교' },
  { code: 'AC5', label: '학원' },
  { code: 'PS3', label: '어린이집/유치원' },
  { code: 'SW8', label: '지하철역' },
  { code: 'PK6', label: '주차장' },
];

/** 키워드 업종 프리셋 */
export const CATEGORY_PRESETS = [
  '안경점', '한의원', '피부과', '정형외과', '치과',
  '학원', '부동산', '음식점', '미용실', '카페',
  '세탁소', '약국', '동물병원', '헬스장', '필라테스',
];
