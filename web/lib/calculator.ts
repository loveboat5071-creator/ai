
import channels from '@/policy/channels.json';
import bonuses from '@/policy/bonuses.json';
import surcharges from '@/policy/surcharges.json';

export interface Channel {
  channel_name: string;
  base_cpv: number;
  cpv_audience: number;
  cpv_non_target: number;
}

export interface Bonus {
  channel_name: string;
  bonus_type: string;
  condition_type: string;
  min_value: number;
  rate: number;
  description: string | null;
}

export interface Surcharge {
  channel_name: string;
  surcharge_type: string;
  condition_value: string;
  rate: number;
  description: string | null;
}

export interface EstimateRequest {
  product_type: 'addressable_tv' | 'focus_media';
  selected_channels: string[];
  channel_budgets: Record<string, number>; // 월 예산 (만원 단위)
  duration: number; // 기간 (개월)
  region_targeting: boolean;
  region_selections: Record<string, string>; // 채널별 지역 선택
  audience_targeting: boolean;
  ad_duration: 15 | 30; // 광고 초수
  custom_targeting: boolean;
  is_new_advertiser: boolean;
  focus_region: 'seoul_gangnam_seocho' | 'seoul_songpa_yangcheon' | 'metro_area';
  focus_complex_count: number;
  focus_weeks: number;
}

export interface EstimateResult {
  details: {
    channel: string;
    budget: number;
    base_cpv: number;
    total_bonus_rate: number;
    total_surcharge_rate: number;
    guaranteed_impressions: number;
    final_cpv: number;
  }[];
  summary: {
    total_budget: number;
    total_impressions: number;
    average_cpv: number;
    ad_duration: number;
    duration_months: number;
  };
}

export function calculateEstimate(req: EstimateRequest): EstimateResult {
  if (req.product_type === 'focus_media') {
    return calculateFocusMediaEstimate(req);
  }

  return calculateAddressableTvEstimate(req);
}

function calculateFocusMediaEstimate(req: EstimateRequest): EstimateResult {
  const regionPricing: Record<EstimateRequest['focus_region'], { label: string; unitPrice: number }> = {
    seoul_gangnam_seocho: { label: '서울 (강남/서초)', unitPrice: 15000 },
    seoul_songpa_yangcheon: { label: '서울 (송파/양천)', unitPrice: 12000 },
    metro_area: { label: '서울, 경기, 인천', unitPrice: 10000 },
  };

  const region = regionPricing[req.focus_region] ?? regionPricing.metro_area;
  const complexCount = Math.max(0, Math.floor(req.focus_complex_count || 0));
  const weeks = Math.max(4, Math.floor(req.focus_weeks || 4));
  const fourWeekUnits = weeks / 4;
  const spotsPerDayPerComplex = 90;
  const totalBudget = Math.round(region.unitPrice * complexCount * fourWeekUnits);
  const totalImpressions = Math.round(complexCount * spotsPerDayPerComplex * 7 * weeks);
  const averageCpv = totalImpressions > 0 ? totalBudget / totalImpressions : 0;

  const results: EstimateResult = { details: [], summary: { total_budget: 0, total_impressions: 0, average_cpv: 0, ad_duration: req.ad_duration, duration_months: req.duration } };
  results.details.push({
    channel: `포커스미디어 동네상권정보 (${region.label})`,
    budget: totalBudget,
    base_cpv: region.unitPrice,
    total_bonus_rate: 0,
    total_surcharge_rate: 0,
    guaranteed_impressions: totalImpressions,
    final_cpv: averageCpv,
  });
  results.summary = {
    total_budget: totalBudget,
    total_impressions: totalImpressions,
    average_cpv: averageCpv,
    ad_duration: 15,
    duration_months: Math.ceil(weeks / 4),
  };

  return results;
}

function calculateAddressableTvEstimate(req: EstimateRequest): EstimateResult {
  const results: EstimateResult = { details: [], summary: { total_budget: 0, total_impressions: 0, average_cpv: 0, ad_duration: req.ad_duration, duration_months: req.duration } };
  let total_budget_won = 0;
  let total_guaranteed_impressions = 0;

  const is_non_targeting = !req.audience_targeting && !req.region_targeting;

  for (const channel_name of req.selected_channels) {
    const budget_mw = req.channel_budgets[channel_name] || 0;
    if (budget_mw === 0) continue;

    const budget_won = budget_mw * 10000;
    total_budget_won += budget_won;

    const channel_info = (channels as Channel[]).find(c => c.channel_name === channel_name);
    if (!channel_info) continue;

    let base_cpv = channel_info.base_cpv;
    if (req.ad_duration === 30) {
      base_cpv *= 2.0;
    }

    let total_bonus_rate = 0.0;

    // 1. Basic Bonus
    const basic_bonuses = (bonuses as Bonus[]).filter(b => b.bonus_type === 'basic' && b.channel_name === channel_name);
    total_bonus_rate += basic_bonuses.reduce((sum, b) => sum + b.rate, 0);

    // 2. Duration Bonus (Max value)
    const duration_bonuses = (bonuses as Bonus[]).filter(
      b => b.bonus_type === 'duration' && b.channel_name === channel_name && b.min_value <= req.duration
    );
    if (duration_bonuses.length > 0) {
      total_bonus_rate += Math.max(...duration_bonuses.map(b => b.rate));
    }

    // 3. Volume Bonus (Max value)
    const volume_bonuses = (bonuses as Bonus[]).filter(
      b => b.bonus_type === 'volume' && b.channel_name === channel_name && b.min_value <= budget_won
    );
    if (volume_bonuses.length > 0) {
      total_bonus_rate += Math.max(...volume_bonuses.map(b => b.rate));
    }

    // 4. Promotion Bonus (New Advertiser)
    if (req.is_new_advertiser) {
      const promo_bonuses = (bonuses as Bonus[]).filter(
        b => b.bonus_type === 'promotion' && b.condition_type === 'new_advertiser' && b.channel_name === channel_name
      );
      total_bonus_rate += promo_bonuses.reduce((sum, b) => sum + b.rate, 0);
    }

    // 5. Non-Targeting Bonus
    if (is_non_targeting) {
      const nt_bonuses = (bonuses as Bonus[]).filter(
        b => b.channel_name === channel_name && b.condition_type === 'non_targeting'
      );
      total_bonus_rate += nt_bonuses.reduce((sum, b) => sum + b.rate, 0);
    }

    let total_surcharge_rate = 0.0;

    // Region Surcharge
    if (req.region_targeting && req.region_selections[channel_name] && req.region_selections[channel_name] !== '선택안함') {
      const region_name = req.region_selections[channel_name];
      const region_surcharges = (surcharges as Surcharge[]).filter(
        s => s.surcharge_type === 'region' && s.channel_name === channel_name && s.condition_value === region_name
      );
      if (region_surcharges.length > 0) {
        total_surcharge_rate += region_surcharges[0].rate * 100.0;
      }
    }

    // Custom Surcharge
    if (req.custom_targeting) {
      const custom_surcharges = (surcharges as Surcharge[]).filter(
        s => s.surcharge_type === 'custom' && s.channel_name === channel_name
      );
      if (custom_surcharges.length > 0) {
        total_surcharge_rate += custom_surcharges[0].rate * 100.0;
      }
    }

    const applied_cpv = base_cpv * (1 + total_surcharge_rate / 100);
    const initial_impressions = applied_cpv > 0 ? budget_won / applied_cpv : 0;
    const guaranteed_impressions = initial_impressions * (1 + total_bonus_rate);
    const final_cpv = guaranteed_impressions > 0 ? budget_won / guaranteed_impressions : 0;

    total_guaranteed_impressions += guaranteed_impressions;

    results.details.push({
      channel: channel_name,
      budget: budget_won,
      base_cpv: base_cpv,
      total_bonus_rate: total_bonus_rate * 100,
      total_surcharge_rate: total_surcharge_rate,
      guaranteed_impressions: Math.round(guaranteed_impressions),
      final_cpv: final_cpv
    });
  }

  results.summary = {
    total_budget: total_budget_won,
    total_impressions: Math.round(total_guaranteed_impressions),
    average_cpv: total_guaranteed_impressions > 0 ? total_budget_won / total_guaranteed_impressions : 0,
    ad_duration: req.ad_duration,
    duration_months: req.duration
  };

  return results;
}
