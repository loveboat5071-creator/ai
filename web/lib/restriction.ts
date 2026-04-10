/**
 * 영업제한 체크 로직
 * Codex 분석: 구좌1 활성 722건, 구좌2 활성 64건 (2026-03-12 기준)
 */

import type { Complex } from './types';

export type RestrictionStatus = 'available' | 'restricted' | 'check_required';

/**
 * 단지의 영업제한 상태를 체크
 * @param complex 단지 정보
 * @param advertiserIndustry 광고주 업종 (예: "외과", "치과")
 * @param campaignDate 캠페인 기준일
 */
export function checkRestriction(
  complex: Complex,
  advertiserIndustry?: string,
  campaignDate?: Date
): RestrictionStatus {
  if (!advertiserIndustry) return 'available';
  
  const today = campaignDate || new Date();

  // 구좌 1 체크
  if (complex.r1_industry && complex.r1_date) {
    const endDate = new Date(complex.r1_date);
    if (!isNaN(endDate.getTime()) && endDate >= today) {
      if (complex.r1_industry === advertiserIndustry) {
        return 'restricted';
      }
    }
  }

  // 구좌 2 체크
  if (complex.r2_industry && complex.r2_date) {
    const endDate = new Date(complex.r2_date);
    if (!isNaN(endDate.getTime()) && endDate >= today) {
      if (complex.r2_industry === advertiserIndustry) {
        return 'restricted';
      }
    }
  }

  return 'available';
}
