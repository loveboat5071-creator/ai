/**
 * 견적서 Excel 생성 (exceljs)
 * ★포커스미디어 제안서 샘플★.xlsx 형식 정밀 재현
 * + 다중 반경: 반경별 가동리스트 시트
 * + 지도 이미지 삽입
 */

import ExcelJS from 'exceljs';
import { buildCreativePlan } from './creativePlan';
import type { CreativeBrief, SearchResponse, MatchedComplex } from './types';
// ── 스타일 상수 ────────────────────────────

const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 16, name: '맑은 고딕' };
const LABEL_FONT: Partial<ExcelJS.Font> = { bold: true, size: 10, name: '맑은 고딕' };
const VALUE_FONT: Partial<ExcelJS.Font> = { size: 10, name: '맑은 고딕' };
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: '맑은 고딕' };
const SUM_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
const THIN_BORDER: Partial<ExcelJS.Border> = { style: 'thin' };
const BORDERS: Partial<ExcelJS.Borders> = {
  top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER,
};
const NUM_FMT = '#,##0';
const DECIMAL_FMT = '#,##0.00';

// ── 메인 생성 함수 ──────────────────────────

export async function generateExcel(
  response: SearchResponse,
  advertiserName: string = '',
  campaignName: string = '',
  creativeBrief?: CreativeBrief,
  excludedColumns: Set<string> = new Set(),
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '㈜더블유에스미디어 FocusMap';
  wb.created = new Date();

  // ── 요약 시트 (제안서 형식) ──────────────
  const wsSummary = wb.addWorksheet('요약');
  buildSummarySheet(wsSummary, response, advertiserName, campaignName);

  const creativePlan = buildCreativePlan({
    advertiser_name: advertiserName,
    campaign_name: campaignName,
    ...creativeBrief,
  });
  const wsCreative = wb.addWorksheet('소재기획');
  buildCreativeSheet(wsCreative, creativePlan, advertiserName, campaignName);

  // ── 반경별 가동리스트 시트 ─────────────────
  const sortedRadii = [...response.radii].sort((a, b) => a - b);

  if (sortedRadii.length > 0) {
    // 반경 모드: 반경별 시트
    for (const radius of sortedRadii) {
      const sheetName = sortedRadii.length === 1
        ? '가동리스트'
        : `가동리스트_${radius}km`;
      const ws = wb.addWorksheet(sheetName);
      const filtered = response.results.filter(r =>
        r.distance_km <= radius && r.restriction_status === 'available'
      );
      buildListSheet(ws, filtered, radius, response.center.address, excludedColumns);
    }
  } else {
    // 지역별 모드: 전체 가동리스트 1개 시트
    const ws = wb.addWorksheet('가동리스트');
    const available = response.results.filter(r => r.restriction_status === 'available');
    buildListSheet(ws, available, 0, response.center.address, excludedColumns);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── 요약 시트 (★포커스미디어 제안서 샘플★ 형식) ──

function buildSummarySheet(
  ws: ExcelJS.Worksheet,
  data: SearchResponse,
  advertiserName: string,
  campaignName: string,
) {
  // 컬럼 너비 설정 (실제 샘플의 B~I 컬럼)
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 12;
  ws.getColumn(7).width = 16;
  ws.getColumn(8).width = 10;
  ws.getColumn(9).width = 14;

  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });

  // Row 1: 제 안 서
  ws.mergeCells('B1:I1');
  const titleCell = ws.getCell('B1');
  titleCell.value = '제  안  서';
  titleCell.font = TITLE_FONT;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 36;

  // Row 3: 주 관 사
  ws.mergeCells('B3:I3');
  ws.getCell('B3').value = '주 관 사';
  ws.getCell('B3').font = { ...LABEL_FONT, size: 12 };
  ws.getCell('B3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

  // Row 4: 법인명 / 사업자번호
  ws.getCell('B4').value = '법 인 명';
  ws.getCell('B4').font = LABEL_FONT;
  ws.mergeCells('C4:E4');
  ws.getCell('C4').value = '㈜더블유에스미디어';
  ws.getCell('C4').font = VALUE_FONT;
  ws.getCell('F4').value = '사업자번호';
  ws.getCell('F4').font = LABEL_FONT;
  ws.mergeCells('G4:I4');
  ws.getCell('G4').value = '595 - 81 - 00716';
  ws.getCell('G4').font = VALUE_FONT;

  // Row 5: 주소 / 담당자
  ws.getCell('B5').value = '주     소';
  ws.getCell('B5').font = LABEL_FONT;
  ws.mergeCells('C5:E5');
  ws.getCell('C5').value = '서울시 서초구 방배중앙로 175, 302호 (방배동)';
  ws.getCell('C5').font = VALUE_FONT;
  ws.getCell('F5').value = '담 당 자';
  ws.getCell('F5').font = LABEL_FONT;
  ws.mergeCells('G5:I5');
  ws.getCell('G5').value = '이 영 주 (010-2241-5071)';
  ws.getCell('G5').font = VALUE_FONT;

  // Row 6: 견적내역
  ws.mergeCells('B6:I6');
  ws.getCell('B6').value = '견 적 내 역';
  ws.getCell('B6').font = { ...LABEL_FONT, size: 12 };
  ws.getCell('B6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

  // Row 7-11: 캠페인 상세 정보
  const infoRows: (string | number)[][] = [
    ['광 고 주', advertiserName || '미정', '세대 수', data.total_households],
    ['캠페인명', campaignName || '미 정 (15초)', '가동 수', data.total_units],
    ['광고상품', '포커스미디어', '집행기간', '4주 기준'],
    ['청약금액', data.total_price_4w, '일보장송출수', '1대당 90회 / 일'],
    ['송출지역', data.center.address],
  ];

  for (let i = 0; i < infoRows.length; i++) {
    const r = 7 + i;
    ws.getCell(r, 2).value = infoRows[i][0];
    ws.getCell(r, 2).font = LABEL_FONT;
    ws.getCell(r, 2).border = BORDERS;
    ws.mergeCells(r, 3, r, 5);
    ws.getCell(r, 3).value = infoRows[i][1];
    ws.getCell(r, 3).font = VALUE_FONT;
    ws.getCell(r, 3).border = BORDERS;
    if (typeof infoRows[i][1] === 'number') ws.getCell(r, 3).numFmt = NUM_FMT;

    if (infoRows[i].length > 2 && infoRows[i][2]) {
      ws.getCell(r, 6).value = infoRows[i][2];
      ws.getCell(r, 6).font = LABEL_FONT;
      ws.getCell(r, 6).border = BORDERS;
      ws.mergeCells(r, 7, r, 9);
      ws.getCell(r, 7).value = infoRows[i][3];
      ws.getCell(r, 7).font = VALUE_FONT;
      ws.getCell(r, 7).border = BORDERS;
      if (typeof infoRows[i][3] === 'number') ws.getCell(r, 7).numFmt = NUM_FMT;
    }
  }

  // Row 12: 테이블 헤더
  const headers = ['광고상품', '타겟', '가동 수', '세대 수', '대당단가', '청약금액/월', '할인률', '비 고'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(12, i + 2);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = BORDERS;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  ws.getRow(12).height = 22;

  // Row 13+: 지역별 데이터
  let row = 13;
  for (const s of data.summaries) {
    const target = `${s.city.replace('특별시', '').replace('광역시', '')} ${s.district}`;
    ws.getCell(row, 2).value = '동네상권';
    ws.getCell(row, 3).value = target;
    ws.getCell(row, 4).value = s.total_units;
    ws.getCell(row, 5).value = s.total_households;
    ws.getCell(row, 6).value = s.avg_unit_price;
    ws.getCell(row, 7).value = s.total_price_4w;
    ws.getCell(row, 8).value = '-';
    ws.getCell(row, 9).value = '';
    for (let c = 2; c <= 9; c++) {
      ws.getCell(row, c).font = VALUE_FONT;
      ws.getCell(row, c).border = BORDERS;
      if (c >= 4 && c <= 7) ws.getCell(row, c).numFmt = NUM_FMT;
    }
    row++;
  }

  // 합계행
  const sumRow = row + 1;
  ws.getCell(sumRow, 2).value = '합  계';
  ws.getCell(sumRow, 4).value = data.total_units;
  ws.getCell(sumRow, 5).value = data.total_households;
  ws.getCell(sumRow, 7).value = data.total_price_4w;
  for (let c = 2; c <= 9; c++) {
    ws.getCell(sumRow, c).font = { ...VALUE_FONT, bold: true };
    ws.getCell(sumRow, c).fill = SUM_FILL;
    ws.getCell(sumRow, c).border = BORDERS;
    if (c >= 4 && c <= 7) ws.getCell(sumRow, c).numFmt = NUM_FMT;
  }

  // 비고행
  const noteRow = sumRow + 1;
  ws.getCell(noteRow, 2).value = '비 고';
  ws.getCell(noteRow, 2).font = LABEL_FONT;
  ws.getCell(noteRow, 2).border = BORDERS;
  ws.mergeCells(noteRow, 3, noteRow + 2, 9);
  ws.getCell(noteRow, 3).value =
    `■ 노출방식 : 18시간(06:00~24:00) Rolling방식으로 송출\n` +
    `■ ${dateStr} 기준(APT List) 작성 된 견적입니다.\n` +
    `■ 실 청약 가능 구좌는 온에어 일정에 맞춰 확인필`;
  ws.getCell(noteRow, 3).alignment = { wrapText: true, vertical: 'top' };
  ws.getCell(noteRow, 3).font = VALUE_FONT;
  ws.getCell(noteRow, 3).border = BORDERS;

  // 결어
  const closeRow = noteRow + 4;
  ws.mergeCells(closeRow, 2, closeRow, 9);
  ws.getCell(closeRow, 2).value = '위와 같이 견적합니다.';
  ws.getCell(closeRow, 2).font = { ...LABEL_FONT, italic: true };
  ws.getCell(closeRow, 2).alignment = { horizontal: 'center' };

  // 행 스타일: B~I 전체 테두리
  for (let r = 3; r <= 5; r++) {
    for (let c = 2; c <= 9; c++) {
      ws.getCell(r, c).border = BORDERS;
    }
  }
}

// ── 가동리스트 시트 (★포커스미디어 제안서 샘플★ Sheet2 형식) ──

// key mapping: UI column key -> index into LIST_HEADERS (0-based)
const LIST_COL_KEYS: (string | null)[] = [
  'name', null/*city*/, 'district', 'dong', null/*addr_parcel*/, 'addr_road',
  'building_type', 'built_year', 'floors', 'area_pyeong', 'households', 'population',
  'units', 'unit_price', 'price_4w', 'public_price', 'public_price_m2',
  null/*rt_price*/, 'rt_price_m2', 'ev_charger', null/*ev_evidence*/, 'distance', null/*note*/,
];

const LIST_HEADERS = [
  '단지명', '도시', '구', '동(법정동)', '주소(지번)', '주소(도로명)',
  '건물유형', '준공연도', '건물층수', '기준평형', '총 세대수', '총 인구수',
  '판매수량', '대당단가', '4주 금액', '공시가격', '공시가/㎡', '실거래가', '실거래가/㎡', '전기차', 'EV근거', '거리(km)', '비고',
];

const LIST_WIDTHS = [22, 8, 12, 10, 32, 40, 8, 8, 8, 8, 10, 10, 8, 10, 12, 12, 12, 12, 12, 10, 26, 8, 10];

function buildListSheet(
  ws: ExcelJS.Worksheet,
  complexes: MatchedComplex[],
  radius: number,
  centerAddress: string,
  excludedColumns: Set<string> = new Set(),
) {
  // Filter columns based on excludedColumns
  const visibleIndices = LIST_COL_KEYS.map((key, i) => {
    if (key === null) return true; // non-mappable columns always shown
    return !excludedColumns.has(key);
  });
  const headers = LIST_HEADERS.filter((_, i) => visibleIndices[i]);
  const widths = LIST_WIDTHS.filter((_, i) => visibleIndices[i]);
  // Row 2: 타이틀
  const lastCol = headers.length + 1;
  ws.mergeCells(2, 2, 2, lastCol);
  ws.getCell('B2').value = radius > 0
    ? `${centerAddress} — 반경 ${radius}km 가동리스트`
    : `${centerAddress || '지역별 조회'} — 가동리스트`;
  ws.getCell('B2').font = { bold: true, size: 13, name: '맑은 고딕' };
  ws.getRow(2).height = 28;

  // Row 3: 헤더
  headers.forEach((h, i) => {
    const cell = ws.getCell(3, i + 2);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = BORDERS;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getColumn(i + 2).width = widths[i];
  });
  ws.getRow(3).height = 22;

  // Row 4+: 데이터
  let row = 4;
  // Indices for numFmt mapping (relative to original 23-column array)
  const origNumFmtIndices = [10, 11, 12, 13, 14, 15, 17];
  const origDecFmtIndices = [16, 18, 21];
  for (const c of complexes) {
    const allVals: (string | number | null)[] = [
      c.name, c.city, c.district, c.dong,
      c.addr_parcel, c.addr_road, c.building_type,
      c.built_year, c.floors, c.area_pyeong,
      c.households, c.population,
      c.units, c.unit_price, c.price_4w,
      c.public_price_median ?? null,
      c.public_price_per_m2_median ?? null,
      c.rt_price_median ?? null,
      c.rt_price_per_m2_median ?? null,
      c.ev_charger_installed ? `설치 ${c.ev_charger_count ?? 0}` : (c.ev_evidence_level === 'low' ? '근접' : null),
      c.ev_evidence_text ?? null,
      parseFloat(c.distance_km.toFixed(2)),
      c.restriction_status === 'available' ? '' : '영업제한',
    ];
    // Filter vals by visible indices
    const vals = allVals.filter((_, i) => visibleIndices[i]);
    vals.forEach((v, i) => {
      const cell = ws.getCell(row, i + 2);
      cell.value = v as ExcelJS.CellValue;
      cell.font = VALUE_FONT;
      cell.border = BORDERS;
      // Map original index back to check numFmt
      const origIdx = visibleIndices.reduce((count, vis, j) => {
        if (j < visibleIndices.length && vis) count++;
        return count;
      }, -1); // simplified: skip numFmt for filtered columns
    });
    row++;
  }

  // 합계행
  row++;
  ws.getCell(row, 2).value = '합  계';
  ws.getCell(row, 2).font = { ...VALUE_FONT, bold: true };
  // Find visible column index for specific sums
  const visIdxMap = new Map<number, number>();
  let vi = 0;
  visibleIndices.forEach((vis, origI) => {
    if (vis) { visIdxMap.set(origI, vi + 2); vi++; }
  });
  if (visIdxMap.has(10)) { ws.getCell(row, visIdxMap.get(10)!).value = complexes.reduce((s, c) => s + (c.households || 0), 0); }
  if (visIdxMap.has(11)) { ws.getCell(row, visIdxMap.get(11)!).value = complexes.reduce((s, c) => s + (c.population || 0), 0); }
  if (visIdxMap.has(12)) { ws.getCell(row, visIdxMap.get(12)!).value = complexes.reduce((s, c) => s + (c.units || 0), 0); }
  if (visIdxMap.has(14)) { ws.getCell(row, visIdxMap.get(14)!).value = complexes.reduce((s, c) => s + (c.price_4w || 0), 0); }
  for (let c = 2; c <= headers.length + 1; c++) {
    ws.getCell(row, c).fill = SUM_FILL;
    ws.getCell(row, c).font = { ...VALUE_FONT, bold: true };
    ws.getCell(row, c).border = BORDERS;
  }

  // 인쇄 설정
  ws.pageSetup = {
    orientation: 'landscape',
    fitToWidth: 1,
    fitToPage: true,
    paperSize: 9, // A4
  };
}

function buildCreativeSheet(
  ws: ExcelJS.Worksheet,
  creativePlan: ReturnType<typeof buildCreativePlan>,
  advertiserName: string,
  campaignName: string,
) {
  ws.columns = [
    { width: 18 },
    { width: 24 },
    { width: 30 },
    { width: 30 },
  ];

  ws.mergeCells('A1:D1');
  ws.getCell('A1').value = '광고 소재 제작 제안';
  ws.getCell('A1').font = TITLE_FONT;
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  const infoRows = [
    ['광고주', advertiserName || '미정'],
    ['캠페인명', campaignName || '미정'],
    ['업종 프로필', creativePlan.profile_label],
    ['제안 컨셉', creativePlan.concept_title],
  ];

  infoRows.forEach((row, index) => {
    const excelRow = index + 3;
    ws.getCell(`A${excelRow}`).value = row[0];
    ws.getCell(`A${excelRow}`).font = LABEL_FONT;
    ws.getCell(`A${excelRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FA' } };
    ws.getCell(`A${excelRow}`).border = BORDERS;
    ws.mergeCells(`B${excelRow}:D${excelRow}`);
    ws.getCell(`B${excelRow}`).value = row[1];
    ws.getCell(`B${excelRow}`).font = VALUE_FONT;
    ws.getCell(`B${excelRow}`).border = BORDERS;
    ws.getCell(`C${excelRow}`).border = BORDERS;
    ws.getCell(`D${excelRow}`).border = BORDERS;
  });

  ws.mergeCells('A8:D8');
  ws.getCell('A8').value = creativePlan.concept_summary;
  ws.getCell('A8').alignment = { wrapText: true, vertical: 'middle' };
  ws.getCell('A8').font = VALUE_FONT;
  ws.getCell('A8').border = BORDERS;
  ws.getRow(8).height = 42;

  const sectionTitles = [
    { row: 10, title: '이미지형 편집안' },
    { row: 18, title: '동영상형 편집안' },
    { row: 25, title: '오디오 / 제작 체크리스트' },
  ];

  sectionTitles.forEach(section => {
    ws.mergeCells(`A${section.row}:D${section.row}`);
    ws.getCell(`A${section.row}`).value = section.title;
    ws.getCell(`A${section.row}`).font = { ...LABEL_FONT, color: { argb: 'FFFFFFFF' } };
    ws.getCell(`A${section.row}`).fill = HEADER_FILL;
    ws.getCell(`A${section.row}`).border = BORDERS;
  });

  ws.getCell('A11').value = '구성';
  ws.getCell('A11').font = LABEL_FONT;
  ws.getCell('A11').border = BORDERS;
  ws.mergeCells('B11:D11');
  ws.getCell('B11').value = `${creativePlan.image_package.composition} / ${creativePlan.image_package.recommendation}`;
  ws.getCell('B11').alignment = { wrapText: true };
  ws.getCell('B11').font = VALUE_FONT;
  ws.getCell('B11').border = BORDERS;

  ws.getCell('A12').value = '소스 전략';
  ws.getCell('A12').font = LABEL_FONT;
  ws.getCell('A12').border = BORDERS;
  ws.mergeCells('B12:D12');
  ws.getCell('B12').value = creativePlan.image_package.source_strategy;
  ws.getCell('B12').alignment = { wrapText: true };
  ws.getCell('B12').font = VALUE_FONT;
  ws.getCell('B12').border = BORDERS;

  creativePlan.image_package.scenes.forEach((scene, index) => {
    const row = 13 + index;
    ws.getCell(`A${row}`).value = scene.title;
    ws.getCell(`A${row}`).font = LABEL_FONT;
    ws.getCell(`A${row}`).border = BORDERS;
    ws.getCell(`B${row}`).value = `${scene.duration_sec}초`;
    ws.getCell(`B${row}`).font = VALUE_FONT;
    ws.getCell(`B${row}`).border = BORDERS;
    ws.getCell(`C${row}`).value = scene.visual;
    ws.getCell(`C${row}`).font = VALUE_FONT;
    ws.getCell(`C${row}`).alignment = { wrapText: true };
    ws.getCell(`C${row}`).border = BORDERS;
    ws.getCell(`D${row}`).value = scene.copy;
    ws.getCell(`D${row}`).font = VALUE_FONT;
    ws.getCell(`D${row}`).alignment = { wrapText: true };
    ws.getCell(`D${row}`).border = BORDERS;
  });

  ws.getCell('A19').value = '편집 스타일';
  ws.getCell('A19').font = LABEL_FONT;
  ws.getCell('A19').border = BORDERS;
  ws.mergeCells('B19:D19');
  ws.getCell('B19').value = `${creativePlan.video_package.style} / ${creativePlan.video_package.recommendation}`;
  ws.getCell('B19').alignment = { wrapText: true };
  ws.getCell('B19').font = VALUE_FONT;
  ws.getCell('B19').border = BORDERS;

  creativePlan.video_package.beats.forEach((beat, index) => {
    const row = 20 + index;
    ws.getCell(`A${row}`).value = beat.time_range;
    ws.getCell(`A${row}`).font = LABEL_FONT;
    ws.getCell(`A${row}`).border = BORDERS;
    ws.getCell(`B${row}`).value = beat.visual;
    ws.getCell(`B${row}`).font = VALUE_FONT;
    ws.getCell(`B${row}`).alignment = { wrapText: true };
    ws.getCell(`B${row}`).border = BORDERS;
    ws.mergeCells(`C${row}:D${row}`);
    ws.getCell(`C${row}`).value = beat.copy;
    ws.getCell(`C${row}`).font = VALUE_FONT;
    ws.getCell(`C${row}`).alignment = { wrapText: true };
    ws.getCell(`C${row}`).border = BORDERS;
    ws.getCell(`D${row}`).border = BORDERS;
  });

  ws.getCell('A26').value = '오디오';
  ws.getCell('A26').font = LABEL_FONT;
  ws.getCell('A26').border = BORDERS;
  ws.mergeCells('B26:D26');
  ws.getCell('B26').value = `${creativePlan.audio.mode_label} / BGM: ${creativePlan.audio.bgm}`;
  ws.getCell('B26').alignment = { wrapText: true };
  ws.getCell('B26').font = VALUE_FONT;
  ws.getCell('B26').border = BORDERS;

  ws.getCell('A27').value = '멘트 예시';
  ws.getCell('A27').font = LABEL_FONT;
  ws.getCell('A27').border = BORDERS;
  ws.mergeCells('B27:D27');
  ws.getCell('B27').value = creativePlan.audio.narration_lines.join('\n');
  ws.getCell('B27').alignment = { wrapText: true, vertical: 'top' };
  ws.getCell('B27').font = VALUE_FONT;
  ws.getCell('B27').border = BORDERS;
  ws.getRow(27).height = 48;

  ws.getCell('A28').value = '필수 자료';
  ws.getCell('A28').font = LABEL_FONT;
  ws.getCell('A28').border = BORDERS;
  ws.mergeCells('B28:D28');
  ws.getCell('B28').value = creativePlan.required_assets.map(asset => `• ${asset}`).join('\n');
  ws.getCell('B28').alignment = { wrapText: true, vertical: 'top' };
  ws.getCell('B28').font = VALUE_FONT;
  ws.getCell('B28').border = BORDERS;
  ws.getRow(28).height = 70;

  ws.getCell('A29').value = '체크리스트';
  ws.getCell('A29').font = LABEL_FONT;
  ws.getCell('A29').border = BORDERS;
  ws.mergeCells('B29:D29');
  ws.getCell('B29').value = creativePlan.production_checklist.map(item => `• ${item}`).join('\n');
  ws.getCell('B29').alignment = { wrapText: true, vertical: 'top' };
  ws.getCell('B29').font = VALUE_FONT;
  ws.getCell('B29').border = BORDERS;
  ws.getRow(29).height = 92;

  ws.pageSetup = {
    orientation: 'portrait',
    fitToWidth: 1,
    fitToPage: true,
    paperSize: 9,
  };
}
