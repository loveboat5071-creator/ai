/**
 * PPT 견적서 생성 (PptxGenJS)
 * 슬라이드 구성: 표지 → 견적 요약 → 소재 제작 제안 → 소재 구성안 → 가동리스트 → 유의사항
 */

import path from 'path';
import PptxGenJS from 'pptxgenjs';
import { buildCreativePlan } from './creativePlan';
import type { CreativeBrief, CreativePlan, SearchResponse, MatchedComplex } from './types';

const BRAND_NAVY = '151B26';
const BRAND_RED = 'E53935';
const BRAND_BLUE = '42536B';
const BRAND_GREEN = '6B7C93';
const BRAND_GOLD = '8D6843';
const WHITE = 'FFFFFF';
const SURFACE = 'F7F8FA';
const PANEL = 'F2F4F7';
const PANEL_ALT = 'EEF2F6';
const BORDER = 'D9E0E8';
const TEXT = '111827';
const TEXT_MUTED = '5B6678';
const FONT_DISPLAY = '맑은 고딕';
const FONT_BODY = '맑은 고딕';
const FONT_LABEL = '맑은 고딕';
const PPT_W = 13.333;
const LOGO_RATIO = 48 / 123;
const LOGO_LIGHT = path.join(process.cwd(), 'public', 'brands', 'site', 'wsmedia-logo-f.png');
const LOGO_DARK = path.join(process.cwd(), 'public', 'brands', 'site', 'wsmedia-logo-c.png');
const COVER_TITLE_IMAGE = path.join(process.cwd(), 'public', 'brands', 'rendered', 'cover-title.png');
const SUMMARY_TITLE_IMAGE = path.join(process.cwd(), 'public', 'brands', 'rendered', 'summary-title.png');
const CREATIVE_TITLE_IMAGE = path.join(process.cwd(), 'public', 'brands', 'rendered', 'creative-title.png');
const STORYBOARD_TITLE_IMAGE = path.join(process.cwd(), 'public', 'brands', 'rendered', 'storyboard-title.png');
const INVENTORY_TITLE_IMAGE = path.join(process.cwd(), 'public', 'brands', 'rendered', 'inventory-title.png');
const NOTICE_TITLE_IMAGE = path.join(process.cwd(), 'public', 'brands', 'rendered', 'notice-title.png');

const SHAPE_RECT = 'rect' as const;
const SHAPE_ROUND_RECT = 'roundRect' as const;
const SHAPE_LINE = 'line' as const;
const SHAPE_ELLIPSE = 'ellipse' as const;

type MetricCard = {
  label: string;
  value: string;
  accent: string;
};



/** macOS에서 넘어오는 NFD 한글을 NFC로 정규화 (자모분리 방지) */
function nfc(s: string): string {
  return s.normalize('NFC');
}

export async function generatePpt(
  response: SearchResponse,
  advertiserName: string = '',
  campaignName: string = '',
  notes: string = '',
  creativeBrief?: CreativeBrief,
  excludedColumns: Set<string> = new Set(),
  includeCreative: boolean = true,
): Promise<Buffer> {
  // ── 모든 한글 텍스트를 NFC 정규화 (macOS NFD → NFC) ──
  const data: SearchResponse = JSON.parse(
    JSON.stringify(response).normalize('NFC'),
  );
  const advName = nfc(advertiserName);
  const campName = nfc(campaignName);
  const notesText = nfc(notes);

  const pptx = new PptxGenJS();
  pptx.author = '㈜더블유에스미디어 FocusMap';
  pptx.company = '㈜더블유에스미디어';
  pptx.subject = '포커스미디어 제안 견적서';
  pptx.title = `포커스미디어 견적서 - ${data.center.address}`;
  pptx.layout = 'LAYOUT_WIDE';
  pptx.theme = {
    headFontFace: FONT_BODY,
    bodyFontFace: FONT_BODY,
  };

  buildCoverSlide(pptx, data, advName, campName);
  buildSummarySlide(pptx, data, advName, campName);

  if (includeCreative) {
    const creativePlan = buildCreativePlan({
      advertiser_name: advName,
      campaign_name: campName,
      ...creativeBrief,
    });
    buildCreativeOverviewSlide(pptx, creativePlan, advName, campName);
    buildCreativeStoryboardSlide(pptx, creativePlan);
  }

  const available = data.results.filter((item) => item.restriction_status === 'available');
  buildListSlides(pptx, available, data, excludedColumns);

  buildNotesSlide(pptx, notesText);

  const arrayBuffer = await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}

function addLogo(
  slide: PptxGenJS.Slide,
  variant: 'light' | 'dark',
  x: number,
  y: number,
  w: number,
) {
  slide.addImage({
    path: variant === 'light' ? LOGO_LIGHT : LOGO_DARK,
    x,
    y,
    w,
    h: w * LOGO_RATIO,
  });
}

function addFooter(slide: PptxGenJS.Slide, rightLabel?: string) {
  slide.addShape(SHAPE_LINE, {
    x: 0.72,
    y: 7.01,
    w: 11.86,
    h: 0,
    line: { color: BORDER, pt: 0.8 },
  });
  slide.addText('WITH SOLUTION MEDIA', {
    x: 0.74,
    y: 7.06,
    w: 3.0,
    h: 0.16,
    fontFace: FONT_LABEL,
    fontSize: 8,
    color: TEXT_MUTED,
    bold: true,
  });
  if (rightLabel) {
    slide.addText(rightLabel, {
      x: 9.2,
      y: 7.05,
      w: 3.35,
      h: 0.18,
      fontFace: FONT_LABEL,
      fontSize: 8,
      color: TEXT_MUTED,
      align: 'right',
    });
  }
}

function addLightChrome(
  slide: PptxGenJS.Slide,
  eyebrow: string,
  subtitle: string,
  titleImagePath: string,
  rightLabel?: string,
) {
  slide.background = { color: WHITE };
  slide.addShape(SHAPE_RECT, {
    x: 0,
    y: 0,
    w: PPT_W,
    h: 0.08,
    fill: { color: BRAND_RED },
    line: { color: BRAND_RED, pt: 0 },
  });
  addLogo(slide, 'dark', 0.72, 0.34, 1.42);
  slide.addText(eyebrow.toUpperCase(), {
    x: 9.12,
    y: 0.44,
    w: 3.4,
    h: 0.16,
    fontFace: FONT_LABEL,
    fontSize: 8.1,
    color: TEXT_MUTED,
    bold: true,
    align: 'right',
  });
  slide.addImage({
    path: titleImagePath,
    x: 0.72,
    y: 0.98,
    w: 4.96,
    h: 0.74,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.74,
      y: 1.76,
      w: 8.5,
      h: 0.14,
      fontFace: FONT_BODY,
      fontSize: 9.4,
      color: TEXT_MUTED,
    });
  }
  slide.addShape(SHAPE_LINE, {
    x: 0.72,
    y: 1.92,
    w: 11.86,
    h: 0,
    line: { color: BORDER, pt: 1 },
  });
  slide.addShape(SHAPE_RECT, {
    x: 0.72,
    y: 1.86,
    w: 0.76,
    h: 0.04,
    fill: { color: BRAND_RED },
    line: { color: BRAND_RED, pt: 0 },
  });
  addFooter(slide, rightLabel);
}

function addMetricCard(slide: PptxGenJS.Slide, x: number, y: number, card: MetricCard) {
  slide.addShape(SHAPE_ROUND_RECT, {
    x,
    y,
    w: 2.75,
    h: 1.16,
    rectRadius: 0.08,
    fill: { color: WHITE },
    line: { color: BORDER, pt: 1 },
  });
  slide.addShape(SHAPE_RECT, {
    x: x + 0.18,
    y: y + 0.16,
    w: 0.42,
    h: 0.05,
    fill: { color: card.accent },
    line: { color: card.accent, pt: 0 },
  });
  slide.addText(card.label, {
    x: x + 0.18,
    y: y + 0.3,
    w: 2.35,
    h: 0.18,
    fontFace: FONT_LABEL,
    fontSize: 8.8,
    color: TEXT_MUTED,
    bold: true,
  });
  slide.addText(card.value, {
    x: x + 0.18,
    y: y + 0.56,
    w: 2.35,
    h: 0.34,
    fontFace: FONT_DISPLAY,
    fontSize: 22,
    color: BRAND_NAVY,
    bold: true,
    fit: 'shrink',
  });
}

function fmt(n: number | null | undefined): string {
  return n != null ? n.toLocaleString('ko-KR') : '-';
}

function fmtRange(values: Array<number | null | undefined>, suffix = ''): string {
  const normalized = values.filter((value): value is number => value != null && !Number.isNaN(value));
  if (normalized.length === 0) return '-';
  const min = Math.min(...normalized);
  const max = Math.max(...normalized);
  return min === max ? `${min}${suffix}` : `${min} - ${max}${suffix}`;
}

function shortOrDefault(value: string, fallback: string): string {
  const normalized = value.trim();
  return normalized || fallback;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildCoverSlide(
  pptx: PptxGenJS,
  data: SearchResponse,
  advertiserName: string,
  campaignName: string,
) {
  const slide = pptx.addSlide();
  const available = data.results.filter((item) => item.restriction_status === 'available');
  const totalPopulation = available.reduce((sum, item) => sum + (item.population || 0), 0);
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  slide.background = { color: WHITE };
  slide.addShape(SHAPE_RECT, {
    x: 0,
    y: 0,
    w: PPT_W,
    h: 0.08,
    fill: { color: BRAND_RED },
    line: { color: BRAND_RED, pt: 0 },
  });
  slide.addShape(SHAPE_RECT, {
    x: 0.72,
    y: 0.36,
    w: 0.06,
    h: 6.38,
    fill: { color: 'F3F4F6' },
    line: { color: 'F3F4F6', pt: 0 },
  });

  addLogo(slide, 'dark', 0.72, 0.46, 1.82);
  slide.addText('MEDIA SALES DECK', {
    x: 0.74,
    y: 1.24,
    w: 1.95,
    h: 0.14,
    fontFace: FONT_LABEL,
    fontSize: 8.2,
    color: BRAND_RED,
    bold: true,
  });
  slide.addImage({
    path: COVER_TITLE_IMAGE,
    x: 0.74,
    y: 1.54,
    w: 5.78,
    h: 1.64,
  });
  slide.addText(shortOrDefault(campaignName, '4주 집행 기준 매체 제안'), {
    x: 0.76,
    y: 3.58,
    w: 5.72,
    h: 0.36,
    fontFace: FONT_DISPLAY,
    fontSize: 18.8,
    color: TEXT,
    bold: true,
    fit: 'shrink',
  });
  slide.addText(shortOrDefault(advertiserName, '광고주 미정'), {
    x: 0.76,
    y: 4.06,
    w: 4.5,
    h: 0.2,
    fontFace: FONT_BODY,
    fontSize: 12.6,
    color: BRAND_NAVY,
    bold: true,
  });
  slide.addText('엘리베이터 미디어 집행안, 제작 방향, 가동 리스트를 한 문서 안에서 바로 검토할 수 있도록 정리했습니다.', {
    x: 0.76,
    y: 4.46,
    w: 5.72,
    h: 0.3,
    fontFace: FONT_BODY,
    fontSize: 12.2,
    color: TEXT_MUTED,
    margin: 0,
    fit: 'shrink',
  });

  // ── 제안 개요 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 7.46, y: 1.26, w: 5.1, h: 4.94, rectRadius: 0.07, fill: { color: WHITE }, line: { color: BORDER, pt: 1 } });
  const overviewRows = [
    { label: '송출지역', value: shortOrDefault(data.center.address, '미정'), large: false },
    { label: '가용 단지', value: `${fmt(data.total_count)}건`, large: true },
    { label: '총 가동수량', value: `${fmt(data.total_units)}대`, large: true },
    { label: '4주 총 금액', value: `${fmt(data.total_price_4w)}원`, large: true },
  ];
  // Build compound text for the panel
  const overviewTextParts: Array<{text: string; options?: Record<string, unknown>}> = [];
  overviewTextParts.push({ text: '제안 개요\n', options: { fontSize: 13, color: BRAND_NAVY, bold: true } });
  overviewTextParts.push({ text: '\n' });
  overviewRows.forEach((row, index) => {
    overviewTextParts.push({ text: `${row.label}\n`, options: { fontSize: 9.8, color: TEXT_MUTED, bold: true } });
    overviewTextParts.push({ text: `${row.value}\n`, options: { fontSize: row.large ? 18.6 : 15.6, color: TEXT, bold: true } });
    if (index < overviewRows.length - 1) {
      overviewTextParts.push({ text: '\n' });
    }
  });
  slide.addText(overviewTextParts, {
    x: 7.66, y: 1.38, w: 4.7, h: 4.70,
    fontFace: FONT_BODY, fontSize: 10, color: TEXT, fit: 'shrink', margin: [6, 8, 6, 8],
  });
  slide.addShape(SHAPE_LINE, {
    x: 7.78,
    y: 5.96,
    w: 4.46,
    h: 0,
    line: { color: BORDER, pt: 1 },
  });
  slide.addText(`기준일 ${dateStr}`, {
    x: 7.78,
    y: 6.08,
    w: 1.8,
    h: 0.16,
    fontFace: FONT_LABEL,
    fontSize: 9.2,
    color: BRAND_RED,
    bold: true,
  });
  slide.addText(`총 인구수 ${fmt(totalPopulation)}명  |  현장 집행 가능 여부와 만첨 단지 여부는 최종 온에어 일정 기준으로 재확인합니다.`, {
    x: 7.78,
    y: 6.34,
    w: 4.46,
    h: 0.28,
    fontFace: FONT_BODY,
    fontSize: 10.2,
    color: TEXT_MUTED,
    margin: 0,
    fit: 'shrink',
  });

  slide.addText(`WSM FocusMap  |  ${dateStr}`, {
    x: 0.74,
    y: 7.02,
    w: 3.5,
    h: 0.16,
    fontFace: FONT_LABEL,
    fontSize: 8.2,
    color: TEXT_MUTED,
    bold: true,
  });
  slide.addText('WITH SOLUTION MEDIA', {
    x: 9.3,
    y: 7.02,
    w: 3.1,
    h: 0.16,
    fontFace: FONT_LABEL,
    fontSize: 8.2,
    color: TEXT_MUTED,
    align: 'right',
    bold: true,
  });
}

function addMiniStat(
  slide: PptxGenJS.Slide,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  options: { dark?: boolean; accent?: string; valueSize?: number } = {},
) {
  const dark = options.dark ?? false;
  const accent = options.accent ?? BRAND_RED;
  slide.addShape(SHAPE_ROUND_RECT, {
    x,
    y,
    w,
    h: 0.92,
    rectRadius: 0.06,
    fill: dark ? { color: WHITE, transparency: 86 } : { color: WHITE },
    line: { color: dark ? '8FA1BC' : BORDER, pt: 0.8 },
  });
  slide.addShape(SHAPE_RECT, {
    x: x + 0.16,
    y: y + 0.14,
    w: 0.42,
    h: 0.05,
    fill: { color: accent },
    line: { color: accent, pt: 0 },
  });
  slide.addText(label, {
    x: x + 0.16,
    y: y + 0.24,
    w: w - 0.32,
    h: 0.14,
    fontFace: FONT_LABEL,
    fontSize: dark ? 7.8 : 8.4,
    color: dark ? 'D7DFEC' : TEXT_MUTED,
    bold: true,
  });
  slide.addText(value, {
    x: x + 0.16,
    y: y + 0.44,
    w: w - 0.32,
    h: 0.18,
    fontFace: FONT_BODY,
    fontSize: options.valueSize ?? 14.5,
    color: dark ? WHITE : TEXT,
    bold: true,
    fit: 'shrink',
  });
}

function buildSummarySlide(
  pptx: PptxGenJS,
  data: SearchResponse,
  advertiserName: string,
  campaignName: string,
) {
  const slide = pptx.addSlide();
  const available = data.results.filter((item) => item.restriction_status === 'available');
  const totalPopulation = available.reduce((sum, item) => sum + (item.population || 0), 0);
  const radiiLabel = data.radii.length > 0 ? `${data.radii.join(', ')}km` : '지역 선택 기준';
  const shownSummaries = data.summaries.slice(0, 4);
  const hiddenCount = Math.max(data.summaries.length - shownSummaries.length, 0);

  addLightChrome(
    slide,
    'Executive Summary',
    '',
    SUMMARY_TITLE_IMAGE,
    'Summary',
  );

  const cards: MetricCard[] = [
    { label: '가용 단지', value: `${fmt(data.total_count)}건`, accent: BRAND_RED },
    { label: '총 가동수량', value: `${fmt(data.total_units)}대`, accent: BRAND_NAVY },
    { label: '총 세대수', value: `${fmt(data.total_households)}세대`, accent: BRAND_BLUE },
    { label: '4주 총 금액', value: `${fmt(data.total_price_4w)}원`, accent: BRAND_RED },
  ];

  cards.forEach((card, index) => {
    addMetricCard(slide, 0.72 + index * 2.88, 2.36, card);
  });

  // ── 캠페인 개요 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 0.72, y: 3.84, w: 3.6, h: 1.54, rectRadius: 0.07, fill: { color: SURFACE }, line: { color: BORDER, pt: 1 } });
  slide.addText([
    { text: '캠페인 개요\n', options: { fontSize: 12, color: BRAND_NAVY, bold: true } },
    { text: '\n' },
    { text: '광고주  ', options: { fontSize: 8.8, color: TEXT_MUTED, bold: true } },
    { text: `${shortOrDefault(advertiserName, '미정')}\n`, options: { fontSize: 11, color: TEXT, bold: true } },
    { text: '캠페인  ', options: { fontSize: 8.8, color: TEXT_MUTED, bold: true } },
    { text: `${shortOrDefault(campaignName, '미정 (15초)')}\n`, options: { fontSize: 11, color: TEXT, bold: true } },
    { text: '송출지역  ', options: { fontSize: 8.8, color: TEXT_MUTED, bold: true } },
    { text: shortOrDefault(data.center.address, '미정'), options: { fontSize: 11, color: TEXT, bold: true } },
  ], {
    x: 0.88, y: 3.94, w: 3.28, h: 1.34,
    fontFace: FONT_BODY, fontSize: 10, color: TEXT, fit: 'shrink', margin: [4, 6, 4, 6],
  });

  // ── 타겟 프로필 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 4.57, y: 3.84, w: 3.6, h: 1.54, rectRadius: 0.07, fill: { color: PANEL }, line: { color: BORDER, pt: 1 } });
  slide.addText([
    { text: '타겟 프로필\n', options: { fontSize: 12, color: BRAND_NAVY, bold: true } },
    { text: '\n' },
    { text: '총 인구수  ', options: { fontSize: 8.8, color: TEXT_MUTED, bold: true } },
    { text: `${fmt(totalPopulation)}명\n`, options: { fontSize: 11, color: TEXT, bold: true } },
    { text: '준공연도  ', options: { fontSize: 8.8, color: TEXT_MUTED, bold: true } },
    { text: `${fmtRange(available.map((item) => item.built_year), '년')}\n`, options: { fontSize: 11, color: TEXT, bold: true } },
    { text: '건물층수  ', options: { fontSize: 8.8, color: TEXT_MUTED, bold: true } },
    { text: fmtRange(available.map((item) => item.floors), '층'), options: { fontSize: 11, color: TEXT, bold: true } },
  ], {
    x: 4.73, y: 3.94, w: 3.28, h: 1.34,
    fontFace: FONT_BODY, fontSize: 10, color: TEXT, fit: 'shrink', margin: [4, 6, 4, 6],
  });

  // ── 집행 조건 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 8.42, y: 3.84, w: 4.16, h: 1.54, rectRadius: 0.07, fill: { color: PANEL_ALT }, line: { color: BORDER, pt: 1 } });
  slide.addText([
    { text: '집행 조건\n', options: { fontSize: 12, color: BRAND_NAVY, bold: true } },
    { text: '\n' },
    { text: '기준평형  ', options: { fontSize: 8.8, color: TEXT_MUTED, bold: true } },
    { text: `${fmtRange(available.map((item) => item.area_pyeong), '평')}\n`, options: { fontSize: 11, color: TEXT, bold: true } },
    { text: '반경/지역 기준  ', options: { fontSize: 8.8, color: TEXT_MUTED, bold: true } },
    { text: `${radiiLabel}\n`, options: { fontSize: 11, color: TEXT, bold: true } },
    { text: '필터 적용  ', options: { fontSize: 8.8, color: TEXT_MUTED, bold: true } },
    { text: data.applied_filters.require_ev ? '전기차 충전기 설치 단지만 포함' : '추가 제한 없이 전체 가용 기준', options: { fontSize: 10, color: TEXT, bold: true } },
  ], {
    x: 8.58, y: 3.94, w: 3.84, h: 1.34,
    fontFace: FONT_BODY, fontSize: 10, color: TEXT, fit: 'shrink', margin: [4, 6, 4, 6],
  });

  const summaryHeader: PptxGenJS.TableRow = [
    { text: '지역', options: { bold: true, color: WHITE, fill: { color: BRAND_NAVY } } },
    { text: '가동수', options: { bold: true, color: WHITE, fill: { color: BRAND_NAVY }, align: 'right' } },
    { text: '세대수', options: { bold: true, color: WHITE, fill: { color: BRAND_NAVY }, align: 'right' } },
    { text: '4주 금액', options: { bold: true, color: WHITE, fill: { color: BRAND_NAVY }, align: 'right' } },
  ];

  const summaryRows: PptxGenJS.TableRow[] = shownSummaries.map((summary, index) => {
    const fill = index % 2 === 0 ? WHITE : SURFACE;
    return [
      { text: `${summary.city.replace(/특별시|광역시/g, '')} ${summary.district}`, options: { fill: { color: fill } } },
      { text: fmt(summary.total_units), options: { fill: { color: fill }, align: 'right' } },
      { text: fmt(summary.total_households), options: { fill: { color: fill }, align: 'right' } },
      { text: fmt(summary.total_price_4w), options: { fill: { color: fill }, align: 'right' } },
    ];
  });

  slide.addTable([summaryHeader, ...summaryRows], {
    x: 0.72,
    y: 5.72,
    w: 9.12,
    fontFace: FONT_BODY,
    fontSize: 10.8,
    border: { type: 'solid', pt: 0.45, color: BORDER },
    colW: [4.02, 1.52, 1.68, 1.9],
    margin: 0.08,
  });

  // ── 해석 포인트 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 10.12, y: 5.72, w: 2.46, h: 1.08, rectRadius: 0.07, fill: { color: SURFACE }, line: { color: BORDER, pt: 1 } });
  const insights = [
    `가용 단지 ${fmt(data.total_count)}건 기준으로 산출했습니다.`,
    hiddenCount > 0 ? `지역 요약은 상위 ${shownSummaries.length}개만 먼저 제시했습니다.` : '지역 요약은 전체 지역을 기준으로 한 장에 정리했습니다.',
    '가격 및 가용 여부는 실제 집행 일정 기준으로 최종 확인이 필요합니다.',
  ];
  slide.addText([
    { text: '해석 포인트\n', options: { fontSize: 9, color: BRAND_NAVY, bold: true } },
    { text: insights.map((item) => `• ${item}`).join('\n'), options: { fontSize: 8 } },
  ], {
    x: 10.24, y: 5.80, w: 2.22, h: 0.92,
    fontFace: FONT_BODY, fontSize: 8, color: TEXT, fit: 'shrink', margin: [2, 4, 2, 4],
  });
}

function buildCreativeOverviewSlide(
  pptx: PptxGenJS,
  creativePlan: CreativePlan,
  advertiserName: string,
  campaignName: string,
) {
  const slide = pptx.addSlide();

  addLightChrome(
    slide,
    'Creative Direction',
    '',
    CREATIVE_TITLE_IMAGE,
    'Creative',
  );

  // ── 핵심 컨셉 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 0.72, y: 2.10, w: 5.28, h: 3.38, rectRadius: 0.07, fill: { color: PANEL }, line: { color: BORDER, pt: 1 } });
  slide.addText([
    { text: '핵심 컨셉\n', options: { fontSize: 13, color: BRAND_NAVY, bold: true } },
    { text: '\n' },
    { text: `${creativePlan.concept_title}\n`, options: { fontSize: 16, color: BRAND_NAVY, bold: true } },
    { text: '\n' },
    { text: `${creativePlan.concept_summary}\n\n`, options: { fontSize: 10.5, color: TEXT } },
    { text: `광고주: ${shortOrDefault(advertiserName, '미정')}  |  캠페인: ${shortOrDefault(campaignName, '미정')}\n`, options: { fontSize: 9, color: TEXT_MUTED, bold: true } },
    { text: `추천 키워드  ${creativePlan.recommended_keywords.join(' · ')}`, options: { fontSize: 9.2, color: BRAND_BLUE, bold: true } },
  ], {
    x: 0.92, y: 2.22, w: 4.88, h: 3.14,
    fontFace: FONT_BODY, fontSize: 10.5, color: TEXT, fit: 'shrink', margin: [4, 6, 4, 6],
  });

  // ── 이미지형 제안 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 6.25, y: 2.10, w: 3.0, h: 1.72, rectRadius: 0.07, fill: { color: SURFACE }, line: { color: BORDER, pt: 1 } });
  slide.addText([
    { text: '이미지형 제안\n', options: { fontSize: 11, color: BRAND_NAVY, bold: true } },
    { text: '\n' },
    { text: `${creativePlan.image_package.composition}\n`, options: { bold: true, fontSize: 9.6 } },
    { text: `${creativePlan.image_package.recommendation}\n`, options: { fontSize: 9.2 } },
    { text: `소스 전략: ${creativePlan.image_package.source_strategy}`, options: { fontSize: 9.2 } },
  ], {
    x: 6.42, y: 2.20, w: 2.66, h: 1.52,
    fontFace: FONT_BODY, fontSize: 9.6, color: TEXT, fit: 'shrink', margin: [4, 6, 4, 6],
  });

  // ── 동영상형 제안 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 9.55, y: 2.10, w: 3.03, h: 1.72, rectRadius: 0.07, fill: { color: SURFACE }, line: { color: BORDER, pt: 1 } });
  slide.addText([
    { text: '동영상형 제안\n', options: { fontSize: 11, color: BRAND_NAVY, bold: true } },
    { text: '\n' },
    { text: `${creativePlan.video_package.style}\n`, options: { bold: true, fontSize: 9.6 } },
    { text: creativePlan.video_package.recommendation, options: { fontSize: 9.2 } },
  ], {
    x: 9.72, y: 2.20, w: 2.7, h: 1.52,
    fontFace: FONT_BODY, fontSize: 9.6, color: TEXT, fit: 'shrink', margin: [4, 6, 4, 6],
  });

  // ── 오디오 및 메시지 운영 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 6.25, y: 4.20, w: 6.33, h: 1.48, rectRadius: 0.07, fill: { color: PANEL_ALT }, line: { color: BORDER, pt: 1 } });
  slide.addText([
    { text: '오디오 및 메시지 운영\n', options: { fontSize: 11, color: BRAND_NAVY, bold: true } },
    { text: '\n' },
    { text: `${creativePlan.audio.mode_label}\n`, options: { bold: true, fontSize: 10 } },
    { text: `BGM: ${creativePlan.audio.bgm}\n`, options: { fontSize: 9.6 } },
    { text: `권장 멘트 방향: ${creativePlan.audio.narration_lines[0]}`, options: { fontSize: 9.6 } },
  ], {
    x: 6.42, y: 4.30, w: 5.98, h: 1.28,
    fontFace: FONT_BODY, fontSize: 10, color: TEXT, fit: 'shrink', margin: [4, 6, 4, 6],
  });

  // ── 필수 자료 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 0.72, y: 5.78, w: 5.9, h: 0.94, rectRadius: 0.07, fill: { color: WHITE }, line: { color: BORDER, pt: 1 } });
  slide.addText([
    { text: '필수 자료\n', options: { fontSize: 9.6, color: BRAND_NAVY, bold: true } },
    { text: creativePlan.required_assets.map((item) => `• ${item}`).join('\n'), options: { fontSize: 8.2 } },
  ], {
    x: 0.88, y: 5.84, w: 5.56, h: 0.78,
    fontFace: FONT_BODY, fontSize: 8.2, color: TEXT, fit: 'shrink', margin: [1, 4, 1, 4],
  });

  // ── 제작 체크리스트 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 6.68, y: 5.78, w: 5.9, h: 0.94, rectRadius: 0.07, fill: { color: WHITE }, line: { color: BORDER, pt: 1 } });
  slide.addText([
    { text: '제작 체크리스트\n', options: { fontSize: 9.6, color: BRAND_NAVY, bold: true } },
    { text: creativePlan.production_checklist.map((item) => `• ${item}`).join('\n'), options: { fontSize: 8.2 } },
  ], {
    x: 6.84, y: 5.84, w: 5.56, h: 0.78,
    fontFace: FONT_BODY, fontSize: 8.2, color: TEXT, fit: 'shrink', margin: [1, 4, 1, 4],
  });
}

function buildCreativeStoryboardSlide(
  pptx: PptxGenJS,
  creativePlan: CreativePlan,
) {
  const slide = pptx.addSlide();

  addLightChrome(
    slide,
    'Storyboard',
    '',
    STORYBOARD_TITLE_IMAGE,
    'Storyboard',
  );

  slide.addText('이미지형 15초 구성', {
    x: 0.72,
    y: 2.10,
    w: 3.2,
    h: 0.22,
    fontFace: FONT_BODY,
    fontSize: 13,
    color: BRAND_NAVY,
    bold: true,
  });

  creativePlan.image_package.scenes.forEach((scene, index) => {
    const x = 0.72 + index * 3.97;
    const accent = index === 0 ? BRAND_RED : index === 1 ? BRAND_BLUE : BRAND_GREEN;
    // 배경 shape만
    slide.addShape(SHAPE_ROUND_RECT, { x, y: 2.42, w: 3.55, h: 1.76, rectRadius: 0.07, fill: { color: SURFACE }, line: { color: BORDER, pt: 1 } });
    // 단일 compound text (제목 + duration + visual + copy)
    slide.addText([
      { text: `Scene ${index + 1}`, options: { fontSize: 12, color: BRAND_NAVY, bold: true } },
      { text: `    ${scene.duration_sec}초\n`, options: { fontSize: 8, color: TEXT_MUTED, bold: true } },
      { text: '\n' },
      { text: `비주얼  ${scene.visual}\n\n`, options: { fontSize: 8.8, color: TEXT } },
      { text: `카피  ${scene.copy}`, options: { fontSize: 9, color: BRAND_BLUE, bold: true } },
    ], {
      x: x + 0.18, y: 2.52, w: 3.2, h: 1.56,
      fontFace: FONT_BODY, fontSize: 10, color: TEXT, fit: 'shrink', margin: [4, 6, 4, 6],
    });
  });

  slide.addText('동영상형 15초 타임라인', {
    x: 0.72,
    y: 4.56,
    w: 4.0,
    h: 0.22,
    fontFace: FONT_BODY,
    fontSize: 13,
    color: BRAND_NAVY,
    bold: true,
  });

  creativePlan.video_package.beats.forEach((beat, index) => {
    const rowY = 4.92 + index * 0.66;
    slide.addShape(SHAPE_ROUND_RECT, {
      x: 0.8,
      y: rowY,
      w: 1.15,
      h: 0.40,
      rectRadius: 0.04,
      fill: { color: index === 0 ? BRAND_RED : index === 1 ? BRAND_BLUE : BRAND_GREEN },
      line: { color: WHITE, pt: 0.2 },
    });
    slide.addText(beat.time_range, {
      x: 0.86,
      y: rowY + 0.10,
      w: 1.02,
      h: 0.12,
      fontFace: FONT_BODY,
      fontSize: 8.5,
      color: WHITE,
      bold: true,
      align: 'center',
    });
    slide.addText(beat.visual, {
      x: 2.18,
      y: rowY + 0.02,
      w: 3.95,
      h: 0.22,
      fontFace: FONT_BODY,
      fontSize: 9.4,
      color: TEXT,
      bold: true,
      fit: 'shrink',
      margin: 0,
    });
    slide.addText(beat.copy, {
      x: 6.2,
      y: rowY + 0.02,
      w: 3.95,
      h: 0.22,
      fontFace: FONT_BODY,
      fontSize: 9.2,
      color: BRAND_BLUE,
      fit: 'shrink',
      margin: 0,
    });
  });

  // ── 오디오 샘플 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 10.3, y: 4.78, w: 2.28, h: 1.62, rectRadius: 0.07, fill: { color: PANEL_ALT }, line: { color: BORDER, pt: 1 } });
  slide.addText([
    { text: 'BGM + 멘트\n', options: { fontSize: 10, color: BRAND_NAVY, bold: true } },
    { text: '\n' },
    { text: `${creativePlan.audio.mode_label}\n`, options: { bold: true, fontSize: 8.2 } },
    { text: `BGM: ${creativePlan.audio.bgm}\n`, options: { fontSize: 8.2 } },
    { text: creativePlan.audio.narration_lines.join('\n'), options: { fontSize: 8.2 } },
  ], {
    x: 10.44, y: 4.88, w: 2.0, h: 1.42,
    fontFace: FONT_BODY, fontSize: 8.2, color: TEXT, fit: 'shrink', margin: [3, 4, 3, 4],
  });
}

function buildListSlides(
  pptx: PptxGenJS,
  complexes: MatchedComplex[],
  data: SearchResponse,
  excludedColumns: Set<string> = new Set(),
) {
  const inventoryTableX = 0.92;
  const inventoryTableY = 2.88;
  const inventoryTableW = 11.46;
  const col = (key: string) => !excludedColumns.has(key);
  const hasRadii = data.radii.length > 0;
  const pageSize = hasRadii ? 5 : 6;
  const pages = chunk(complexes, pageSize);
  const safePages = pages.length > 0 ? pages : [[]];

  // Build dynamic column definitions
  type ColDef = {
    key: string;
    header: string;
    width: number;
    align: 'left' | 'center' | 'right';
    getValue: (c: MatchedComplex, idx: number) => string;
  };
  const allCols: ColDef[] = [
    { key: '_no', header: 'No', width: 0.48, align: 'center', getValue: (_c, idx) => String(idx) },
    { key: 'name', header: '단지명', width: 2.56, align: 'left', getValue: (c) => c.name },
    { key: 'district', header: '행정동', width: 1.64, align: 'center', getValue: (c) => `${c.district} ${c.dong}`.trim() },
    { key: 'households', header: '세대', width: 0.68, align: 'right', getValue: (c) => fmt(c.households) },
    { key: 'population', header: '인구', width: 0.73, align: 'right', getValue: (c) => fmt(c.population) },
    { key: 'built_year', header: '준공', width: 0.66, align: 'center', getValue: (c) => c.built_year != null ? String(c.built_year) : '-' },
    { key: 'floors', header: '층', width: 0.48, align: 'center', getValue: (c) => c.floors != null ? String(c.floors) : '-' },
    { key: 'area_pyeong', header: '평형', width: 0.54, align: 'center', getValue: (c) => c.area_pyeong != null ? String(c.area_pyeong) : '-' },
    { key: 'units', header: '수량', width: 0.63, align: 'right', getValue: (c) => fmt(c.units) },
    { key: 'unit_price', header: '단가', width: 0.92, align: 'right', getValue: (c) => fmt(c.unit_price) },
    { key: 'price_4w', header: '4주', width: 1.02, align: 'right', getValue: (c) => fmt(c.price_4w) },
    { key: 'ev_charger', header: 'EV', width: 0.4, align: 'center', getValue: (c) => c.ev_charger_installed ? 'Y' : '-' },
  ];
  if (hasRadii) {
    allCols.push({ key: 'distance', header: '거리', width: 0.72, align: 'right', getValue: (c) => `${c.distance_km.toFixed(1)}km` });
  }
  // _no is always shown; filter the rest by excludedColumns
  const visibleCols = allCols.filter(c => c.key === '_no' || col(c.key));
  const colWidths = visibleCols.map(c => c.width);

  safePages.forEach((pageRows, pageIndex) => {
    const slide = pptx.addSlide();
    const pageStart = pageIndex * pageSize + 1;
    const pageEnd = pageIndex * pageSize + pageRows.length;
    const subtitle = complexes.length === 0
      ? `${data.center.address} · 출력 가능한 단지가 없습니다.`
      : `${data.center.address} · ${complexes.length}건 중 ${pageStart}-${pageEnd}건`;

    addLightChrome(
      slide,
      'Inventory',
      subtitle,
      INVENTORY_TITLE_IMAGE,
      `Inventory ${pageIndex + 1}/${safePages.length}`,
    );

    slide.addShape(SHAPE_ROUND_RECT, {
      x: 0.72,
      y: 1.72,
      w: 11.86,
      h: 4.82,
      rectRadius: 0.07,
      fill: { color: WHITE },
      line: { color: BORDER, pt: 1 },
    });

    if (pageRows.length === 0) {
      slide.addText('선택된 단지가 없어 가동리스트를 생성하지 않았습니다.', {
        x: 1.02,
        y: 3.7,
        w: 11.2,
        h: 0.3,
        fontFace: FONT_BODY,
        fontSize: 18,
        color: TEXT_MUTED,
        bold: true,
        align: 'center',
      });
      return;
    }

    addMiniStat(slide, 0.92, 1.92, 1.6, '가용 단지', `${fmt(complexes.length)}건`, {
      accent: BRAND_RED,
      valueSize: 13.8,
    });
    addMiniStat(slide, 2.72, 1.92, 1.6, '총 가동수량', `${fmt(complexes.reduce((sum, item) => sum + (item.units || 0), 0))}대`, {
      accent: BRAND_BLUE,
      valueSize: 13.8,
    });
    addMiniStat(slide, 4.52, 1.92, 1.95, '4주 총 금액', `${fmt(complexes.reduce((sum, item) => sum + (item.price_4w || 0), 0))}원`, {
      accent: BRAND_RED,
      valueSize: 12.4,
    });

    const headerRow: PptxGenJS.TableRow = visibleCols.map((c) => ({
      text: c.header,
      options: {
        bold: true,
        color: WHITE,
        fill: { color: BRAND_NAVY },
        align: 'center',
      },
    }));

    const bodyRows: PptxGenJS.TableRow[] = pageRows.map((complex, index) => {
      const absoluteIndex = pageIndex * pageSize + index + 1;
      const fill = index % 2 === 0 ? WHITE : SURFACE;
      return visibleCols.map((c) => ({
        text: c.getValue(complex, absoluteIndex),
        options: {
          fill: { color: fill },
          align: c.align,
          valign: 'middle',
          margin: c.key === 'name' ? 0.04 : 0.035,
          ...(c.key === 'name'
            ? { fontSize: 9.6, fit: 'shrink' as const }
            : { fit: 'shrink' as const }),
        },
      }));
    });

    slide.addTable([headerRow, ...bodyRows], {
      x: inventoryTableX,
      y: inventoryTableY,
      w: inventoryTableW,
      fontFace: FONT_BODY,
      fontSize: 10.2,
      border: { type: 'solid', pt: 0.35, color: BORDER },
      colW: colWidths,
      rowH: 0.56,
      margin: 0.05,
    });

    slide.addText('금액은 VAT 별도 기준이며, 실제 집행 가능 여부는 최종 온에어 일정 확인이 필요합니다.', {
      x: 0.96,
      y: 6.9,
      w: 11.2,
      h: 0.14,
      fontFace: FONT_BODY,
      fontSize: 8.8,
      color: TEXT_MUTED,
      italic: true,
    });
  });
}

function buildNotesSlide(pptx: PptxGenJS, customNotes: string) {
  const slide = pptx.addSlide();
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  addLightChrome(
    slide,
    'Notice',
    '',
    NOTICE_TITLE_IMAGE,
    'Notice',
  );

  const defaultNotes = [
    '노출방식은 18시간(06:00~24:00) Rolling 방식입니다.',
    `${dateStr} 기준 APT List로 작성된 견적입니다.`,
    '실 청약 가능 구좌는 온에어 일정에 맞춰 최종 확인이 필요합니다.',
    '제시 금액은 VAT 별도이며, 할인 적용 전 기준입니다.',
    '1대당 일보장 송출수는 90회/일 기준입니다.',
    '만첨 단지는 영업 상황에 따라 집행 불가 또는 조정될 수 있습니다.',
  ];

  // ── 운영 기준 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 0.72, y: 2.10, w: 7.18, h: 4.50, rectRadius: 0.07, fill: { color: SURFACE }, line: { color: BORDER, pt: 1 } });
  slide.addText([
    { text: '운영 기준\n', options: { fontSize: 13, color: BRAND_NAVY, bold: true } },
    { text: '\n' },
    { text: defaultNotes.map((item) => `• ${item}`).join('\n'), options: { fontSize: 11.2 } },
  ], {
    x: 0.88, y: 2.22, w: 6.86, h: 4.26,
    fontFace: FONT_BODY, fontSize: 11.2, color: TEXT, lineSpacingMultiple: 1.3, fit: 'shrink', margin: [6, 8, 6, 8],
  });

  // ── 추가 안내 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 8.18, y: 2.10, w: 4.4, h: 1.96, rectRadius: 0.07, fill: { color: PANEL }, line: { color: BORDER, pt: 1 } });
  slide.addText([
    { text: '추가 안내\n', options: { fontSize: 12, color: BRAND_NAVY, bold: true } },
    { text: '\n' },
    { text: customNotes.trim()
      ? customNotes
      : '별도 추가 메모가 없는 기본 제안서입니다.\n현장 조건, 소재 일정, 업종 제한은 영업 담당자와 최종 확인해 주세요.',
      options: { fontSize: 10 } },
  ], {
    x: 8.34, y: 2.20, w: 4.08, h: 1.76,
    fontFace: FONT_BODY, fontSize: 10, color: TEXT, fit: 'shrink', margin: [4, 6, 4, 6],
  });

  // ── 담당자 정보 (단일 박스) ──
  slide.addShape(SHAPE_ROUND_RECT, { x: 8.18, y: 4.34, w: 4.4, h: 1.44, rectRadius: 0.07, fill: { color: WHITE }, line: { color: BORDER, pt: 1 } });
  slide.addText([
    { text: '담당자 정보\n', options: { fontSize: 12, color: BRAND_NAVY, bold: true } },
    { text: '\n' },
    { text: '㈜더블유에스미디어\n', options: { fontSize: 12, color: TEXT, bold: true } },
    { text: '서울시 서초구 방배중앙로 175, 302호\n', options: { fontSize: 10, color: TEXT } },
    { text: '이영주  |  010-2241-5071', options: { fontSize: 10, color: TEXT } },
  ], {
    x: 8.34, y: 4.44, w: 4.08, h: 1.24,
    fontFace: FONT_BODY, fontSize: 10, color: TEXT, fit: 'shrink', margin: [4, 6, 4, 6],
  });

  slide.addShape(SHAPE_ROUND_RECT, {
    x: 8.18,
    y: 6.04,
    w: 4.4,
    h: 0.56,
    rectRadius: 0.07,
    fill: { color: BRAND_NAVY },
    line: { color: BRAND_NAVY, pt: 0 },
  });
  addLogo(slide, 'light', 8.46, 6.10, 1.30);
  slide.addText('집행 검토부터 소재 운영까지 WSM이 함께 진행합니다.', {
    x: 9.86,
    y: 6.12,
    w: 2.38,
    h: 0.3,
    fontFace: FONT_BODY,
    fontSize: 8.6,
    color: 'DCE7F7',
    fit: 'shrink',
    margin: 0,
  });
}
