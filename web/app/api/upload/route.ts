/**
 * 마스터 데이터 업로드 API
 * 엑셀 파일 → 파싱 → Vercel Blob 저장 (영구)
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { saveToBlob, invalidateCache } from '@/lib/masterData';
import { makeComplexId } from '@/lib/types';

type ParsedRecord = Record<string, unknown>;

const ENRICHMENT_FIELDS = [
  'building_type',
  'premium',
  'r1_industry',
  'r1_date',
  'r2_industry',
  'r2_date',
  'public_price_median',
  'public_price_max',
  'public_price_per_m2_median',
  'public_price_sample_count',
  'public_price_base_date',
  'public_price_source',
  'public_price_match_method',
  'rt_price_per_m2_median',
  'rt_price_median',
  'rt_price_sample_count',
  'rt_price_base_period',
  'rt_price_source',
  'rt_price_match_method',
  'ev_charger_installed',
  'ev_charger_count',
  'ev_evidence_level',
  'ev_evidence_text',
  'ev_evidence_source',
  'ev_nearest_distance_m',
  'ev_updated_at',
  'lat',
  'lng',
] as const;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = /\.(xlsx|xlsm|xls)$/i;
const ALLOWED_FILE_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.ms-excel.sheet.binary.macroenabled.12',
  'application/octet-stream',
]);
function validateUploadFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return '파일 크기는 최대 10MB까지 업로드 가능합니다.';
  }

  const fileName = (file.name || '').trim();
  if (!ALLOWED_FILE_EXTENSIONS.test(fileName)) {
    return '지원되지 않는 확장자입니다. xlsx/xls/xlsm 파일만 업로드 가능합니다.';
  }

  if (file.type && !ALLOWED_FILE_TYPES.has(file.type)) {
    return '지원되지 않는 파일 형식입니다.';
  }

  return null;
}

function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, '').replace(/[()/_-]/g, '').toLowerCase();
}

function canUseLooseHeaderMatch(alias: string): boolean {
  return normalizeHeader(alias).length >= 3;
}

function findHeaderColumn(headers: string[], aliases: string[]): string | null {
  const normalizedAliases = aliases.map(normalizeHeader).filter(Boolean);

  for (let i = 1; i < headers.length; i += 1) {
    const normalizedHeader = normalizeHeader(headers[i] || '');
    if (!normalizedHeader) continue;
    if (normalizedAliases.includes(normalizedHeader)) {
      return String(i);
    }
  }

  for (let i = 1; i < headers.length; i += 1) {
    const normalizedHeader = normalizeHeader(headers[i] || '');
    if (!normalizedHeader) continue;
    if (normalizedAliases.some(alias => canUseLooseHeaderMatch(alias) && normalizedHeader.includes(alias))) {
      return String(i);
    }
  }

  return null;
}

function normalizeKeyPart(value: unknown): string {
  return String(value || '').replace(/\s+/g, '').trim().toLowerCase();
}

function buildLookupKeys(record: ParsedRecord): string[] {
  const name = String(record.name || '').trim();
  const addrRoad = String(record.addr_road || '').trim();
  const addrParcel = String(record.addr_parcel || '').trim();
  const district = String(record.district || '').trim();
  const dong = String(record.dong || '').trim();

  const keys = new Set<string>();
  if (name) {
    keys.add(`id:${makeComplexId(name, addrRoad, addrParcel)}`);
    if (addrRoad) keys.add(`road:${normalizeKeyPart(name)}__${normalizeKeyPart(addrRoad)}`);
    if (addrParcel) keys.add(`parcel:${normalizeKeyPart(name)}__${normalizeKeyPart(addrParcel)}`);
    if (district || dong) keys.add(`area:${normalizeKeyPart(name)}__${normalizeKeyPart(district)}__${normalizeKeyPart(dong)}`);
  }
  return [...keys];
}

function loadBundledMasterSnapshot(): ParsedRecord[] {
  const filePath = join(process.cwd(), 'public', 'data', 'master.json');
  return JSON.parse(readFileSync(filePath, 'utf-8')) as ParsedRecord[];
}

function enrichWithBundledFields(records: ParsedRecord[]) {
  const bundled = loadBundledMasterSnapshot();
  const lookup = new Map<string, ParsedRecord>();

  for (const row of bundled) {
    for (const key of buildLookupKeys(row)) {
      if (!lookup.has(key)) lookup.set(key, row);
    }
  }

  const stats = {
    latLngFilled: 0,
    restrictionsFilled: 0,
    pricingFilled: 0,
    evFilled: 0,
    matchedRows: 0,
  };

  const enriched = records.map((row) => {
    const matched = buildLookupKeys(row)
      .map((key) => lookup.get(key))
      .find(Boolean);

    if (!matched) return row;

    stats.matchedRows += 1;

    const next = { ...row };
    const hadLatLng = next.lat != null && next.lng != null;
    const hadRestriction = next.r1_industry != null || next.r2_industry != null;
    const hadPricing = next.public_price_median != null || next.rt_price_per_m2_median != null;
    const hadEv = next.ev_charger_installed != null;

    for (const field of ENRICHMENT_FIELDS) {
      if (next[field] == null || next[field] === '') {
        const fallbackValue = matched[field];
        if (fallbackValue != null && fallbackValue !== '') {
          next[field] = fallbackValue;
        }
      }
    }

    if (!hadLatLng && next.lat != null && next.lng != null) stats.latLngFilled += 1;
    if (!hadRestriction && (next.r1_industry != null || next.r2_industry != null)) stats.restrictionsFilled += 1;
    if (!hadPricing && (next.public_price_median != null || next.rt_price_per_m2_median != null)) stats.pricingFilled += 1;
    if (!hadEv && next.ev_charger_installed != null) stats.evFilled += 1;

    return next;
  });

  return { enriched, stats };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const action = String(formData.get('action') || '');

    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 });
    }

    const fileValidationError = validateUploadFile(file);
    if (fileValidationError) {
      return NextResponse.json({ error: fileValidationError }, { status: 400 });
    }

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const arrBuf = await file.arrayBuffer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(arrBuf as any);

    const ws = wb.worksheets[0];
    if (!ws) {
      return NextResponse.json({ error: '시트를 찾을 수 없습니다' }, { status: 400 });
    }

    // 헤더 자동 감지 (1~10행 스캔)
    const knownHeaders = [
      '단지명', '아파트명', '도시', '구', '동', '세대수', '판매수량', '대당단가', '위도', '경도',
      '도로명주소', '건물유형', '주소(지번)', '주소(도로명)', '총 세대수', '총 인구수', '4주 금액',
      '공시가격', '공시가/㎡', '실거래가/㎡', '전기차', 'name', 'households', 'units',
    ];
    let headerRowNum = 1;
    const headers: string[] = [];

    for (let r = 1; r <= Math.min(20, ws.rowCount); r++) {
      const row = ws.getRow(r);
      const cellValues: string[] = [];
      row.eachCell((cell) => {
        cellValues.push(String(cell.value || '').trim());
      });
      const matchCount = cellValues.filter(v =>
        knownHeaders.some(kh => {
          const normalizedValue = normalizeHeader(v);
          const normalizedHeader = normalizeHeader(kh);
          return normalizedValue.includes(normalizedHeader) || normalizedValue === normalizedHeader;
        })
      ).length;
      if (matchCount >= 5) {
        headerRowNum = r;
        row.eachCell((cell, colNumber) => {
          headers[colNumber] = String(cell.value || '').trim();
        });
        break;
      }
    }

    // 폴백: 첫 행을 헤더로 사용
    if (headers.length === 0) {
      ws.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || '').trim();
      });
      headerRowNum = 1;
    }

    // 컬럼 매핑
    const colMap: Record<string, string> = {};
    const mapping: Record<string, string[]> = {
      name: ['단지명', '아파트명', 'name', '명칭'],
      city: ['도시', '시도', '시', 'city'],
      district: ['시군구', '구군', '구', 'district'],
      dong: ['동', '법정동', 'dong'],
      addr_parcel: ['지번주소', '주소(지번)', '주소_지번', 'addr_parcel'],
      addr_road: ['도로명주소', '주소(도로명)', '주소_도로명', 'addr_road', '도로명'],
      building_type: ['건물유형', '유형', 'building_type'],
      built_year: ['준공연도', '준공년도', 'built_year'],
      floors: ['건물층수', '층수', 'floors'],
      area_pyeong: ['기준평형', '평형', 'area_pyeong'],
      households: ['총세대수', '세대수', 'households', '총 세대수'],
      population: ['총인구수', '인구수', 'population', '총 인구수'],
      units: ['판매수량', '판매', 'units'],
      unit_price: ['대당단가', '단가', 'unit_price'],
      price_4w: ['4주금액', '4주 금액', 'price_4w'],
      premium: ['프리미엄', 'premium'],
      public_price_median: ['공시가격', '대표공시가격', 'public_price_median'],
      public_price_per_m2_median: ['공시가/㎡', '공시가격/㎡', 'public_price_per_m2_median'],
      rt_price_median: ['실거래가', '대표실거래가', 'rt_price_median'],
      rt_price_per_m2_median: ['실거래가/㎡', 'rt_price_per_m2_median'],
      ev_charger_installed: ['전기차', '전기차설치', 'ev_charger_installed'],
      ev_charger_count: ['전기차수량', '충전기수', 'ev_charger_count'],
      r1_industry: ['구좌1업종', '영업제한1', 'r1_industry'],
      r1_date: ['구좌1일자', '영업제한일1', 'r1_date'],
      r2_industry: ['구좌2업종', '영업제한2', 'r2_industry'],
      r2_date: ['구좌2일자', '영업제한일2', 'r2_date'],
      lat: ['위도', 'lat', 'latitude'],
      lng: ['경도', 'lng', 'longitude'],
    };

    for (const [field, aliases] of Object.entries(mapping)) {
      const matchedColumn = findHeaderColumn(headers, aliases);
      if (matchedColumn) {
        colMap[field] = matchedColumn;
      }
    }

    // 데이터 파싱
    const records: Record<string, unknown>[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNum) return;
      const record: Record<string, unknown> = {};
      let hasData = false;

      for (const [field, colStr] of Object.entries(colMap)) {
        const col = parseInt(colStr);
        const cellValue = row.getCell(col).value;
        if (cellValue != null && cellValue !== '') hasData = true;

        const numFields = [
          'built_year', 'floors', 'area_pyeong', 'households', 'population', 'units', 'unit_price', 'price_4w',
          'public_price_median', 'public_price_per_m2_median', 'rt_price_median', 'rt_price_per_m2_median',
          'ev_charger_count', 'lat', 'lng',
        ];
        if (numFields.includes(field)) {
          const num = Number(cellValue);
          record[field] = isNaN(num) ? null : num;
        } else if (field === 'ev_charger_installed') {
          const text = String(cellValue || '').trim().toLowerCase();
          record[field] = text === '1' || text === 'true' || text === 'y' || text === 'yes' || text.startsWith('설치');
        } else if (field.includes('date') && cellValue instanceof Date) {
          record[field] = cellValue.toISOString().slice(0, 10);
        } else {
          record[field] = cellValue != null ? String(cellValue).trim() : null;
        }
      }

      if (hasData && record.name) {
        if (!record.city) record.city = '서울특별시';
        if (!record.building_type) record.building_type = '아파트';
        records.push(record);
      }
    });

    if (action === 'save') {
      const { enriched, stats } = enrichWithBundledFields(records);

      // Vercel Blob에 저장 시도
      const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

      if (hasBlob) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await saveToBlob(enriched as any[], {
          displayName: file.name,
          uploadedAt: new Date().toISOString(),
          rowCount: enriched.length,
        });
        if (result.success) {
          return NextResponse.json({
            success: true,
            message: `✅ ${enriched.length}건 Blob 저장 완료`,
            count: enriched.length,
            storage: 'vercel-blob',
            url: result.url,
            enrichment: stats,
          });
        }
        return NextResponse.json({
          success: false,
          message: `Blob 저장 실패: ${result.error}`,
          count: enriched.length,
          enrichment: stats,
        });
      }

      // 로컬 파일 시스템 저장 시도 (개발 환경)
      try {
        const fs = await import('fs');
        const path = await import('path');
        const targetPath = path.join(process.cwd(), 'public', 'data', 'master.json');
        const metaPath = path.join(process.cwd(), 'public', 'data', 'master.meta.json');
        fs.writeFileSync(targetPath, JSON.stringify(enriched, null, 2), 'utf-8');
        fs.writeFileSync(metaPath, JSON.stringify({
          displayName: file.name,
          uploadedAt: new Date().toISOString(),
          rowCount: enriched.length,
        }, null, 2), 'utf-8');
        invalidateCache();
        return NextResponse.json({
          success: true,
          message: `✅ ${enriched.length}건 로컬 저장 완료`,
          count: enriched.length,
          storage: 'local',
          enrichment: stats,
        });
      } catch {
        return NextResponse.json({
          success: false,
          message: 'Blob Store를 연결하거나 로컬 환경에서 실행해주세요.',
          count: enriched.length,
          enrichment: stats,
        });
      }
    }

    // 미리보기
    return NextResponse.json({
      success: true,
      message: `📋 ${records.length}건 파싱 완료 (미리보기)`,
      count: records.length,
      headers_detected: Object.entries(colMap).map(([f, c]) => `${f} → 컬럼${c} (${headers[parseInt(c)]})`),
      preview: records.slice(0, 10),
    });

  } catch (error) {
    return NextResponse.json({ error: `업로드 실패: ${error}` }, { status: 500 });
  }
}
