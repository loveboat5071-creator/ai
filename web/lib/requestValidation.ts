export type RouteSortBy =
  | 'distance'
  | 'public_price_desc'
  | 'public_price_per_m2_desc'
  | 'rt_price_per_m2_desc';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const DEFAULT_MAX_RADIUS_KM = 20;

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function parseFiniteCoordinate(
  value: unknown,
  field: string,
  min: number,
  max: number
): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new ValidationError(`${field}는 유효한 숫자여야 합니다.`);
  }
  if (num < min || num > max) {
    throw new ValidationError(`${field}는 ${min} ~ ${max} 사이여야 합니다.`);
  }
  return num;
}

export function parseLatitude(value: unknown, required = false): number {
  if (!required && isEmpty(value)) return Number.NaN;
  if (isEmpty(value)) {
    throw new ValidationError('위도(lat)가 필요합니다.');
  }
  return parseFiniteCoordinate(value, '위도(lat)', -90, 90);
}

export function parseLongitude(value: unknown, required = false): number {
  if (!required && isEmpty(value)) return Number.NaN;
  if (isEmpty(value)) {
    throw new ValidationError('경도(lng)가 필요합니다.');
  }
  return parseFiniteCoordinate(value, '경도(lng)', -180, 180);
}

export function parseCoordinatePair(lat: unknown, lng: unknown, required = false): { lat: number; lng: number } | null {
  const missingLat = isEmpty(lat);
  const missingLng = isEmpty(lng);

  if (!required && missingLat && missingLng) return null;
  if (!required && (missingLat || missingLng)) {
    throw new ValidationError('좌표 조회 모드에서는 위도와 경도 둘 다 함께 제공해야 합니다.');
  }

  const parsedLat = parseLatitude(lat, true);
  const parsedLng = parseLongitude(lng, true);

  if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
    return null;
  }
  return {
    lat: parsedLat,
    lng: parsedLng,
  };
}

export function parseRadii(raw: unknown, required = false, maxKm = DEFAULT_MAX_RADIUS_KM): number[] {
  if (!Array.isArray(raw)) {
  if (required) {
      throw new ValidationError('반경 값이 필요합니다.');
  }
    return [];
  }

  const values: number[] = [];
  const invalid: string[] = [];

  for (const item of raw) {
    const num = Number(item);
    if (!Number.isFinite(num) || num <= 0) {
      invalid.push(String(item));
      continue;
    }
    if (num > maxKm) {
      invalid.push(String(item));
      continue;
    }
    values.push(num);
  }

  if (required && values.length === 0) {
    throw new ValidationError(`반경은 0보다 크고 ${maxKm}km 이하여야 합니다.`);
  }
  if (invalid.length > 0) {
    throw new ValidationError(`유효하지 않은 반경 값: ${invalid.slice(0, 6).join(', ')}`);
  }

  return values;
}

export function parseCampaignDate(value: unknown): string | undefined {
  if (isEmpty(value)) return undefined;
  const text = String(value).trim();
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError('campaign_date 형식이 잘못되었습니다.');
  }
  return text;
}

export function parseDistricts(value: unknown, required = false): string[] {
  const list = Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : [];
  if (required && list.length === 0) {
    throw new ValidationError('지역 목록이 필요합니다.');
  }
  return list;
}

export function parseSortBy(value: unknown): RouteSortBy {
  if (!value) return 'distance';
  if (
    value === 'distance' ||
    value === 'public_price_desc' ||
    value === 'public_price_per_m2_desc' ||
    value === 'rt_price_per_m2_desc'
  ) {
    return value;
  }
  return 'distance';
}
