/**
 * 텔레그램 봇 Webhook
 * 
 * 반경 모드: "마포구 용강동 122-1 기준 2Km"
 * 지역 모드: "강남구, 서초구 견적" 또는 "지역: 강남구, 서초구, 송파구"
 * → 주소 파싱 → geocode/district 검색 → Excel 견적서 회신
 * 
 * Webhook URL: POST /api/telegram
 * Vercel 환경변수: TELEGRAM_BOT_TOKEN
 */

import { NextRequest, NextResponse } from 'next/server';
import { appendActivityLog, getClientIp } from '@/lib/activityLog';
import { escapeHtml, sanitizeFilenameSegment } from '@/lib/escape';
import { searchNearby, searchByDistrict, loadMasterDataAsync } from '@/lib/masterData';
import { generateExcel } from '@/lib/excelGenerator';
import { parseWithAI } from '@/lib/aiParser';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

function escapeTelegramHtml(value: unknown): string {
  return escapeHtml(value);
}

// ── Telegram API 헬퍼 ────────────────

async function sendMessage(chatId: number, text: string, parseMode = 'HTML') {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  });
}

async function sendDocument(chatId: number, buffer: Buffer, filename: string, caption?: string) {
  const formData = new FormData();
  formData.append('chat_id', chatId.toString());
  formData.append('document', new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }), filename);
  if (caption) formData.append('caption', caption);

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
    method: 'POST',
    body: formData,
  });
}

// ── 메시지 파싱 ──────────────────────

interface ParsedRequest {
  mode: 'radius' | 'district';
  address: string;
  radii: number[];
  districts: string[];
  advertiserName?: string;
}

// 마스터 데이터에서 유효한 구/군 목록 캐시
let cachedDistricts: Set<string> | null = null;
async function getValidDistricts(): Promise<Set<string>> {
  if (cachedDistricts) return cachedDistricts;
  const data = await loadMasterDataAsync();
  cachedDistricts = new Set(data.map(d => d.district).filter(Boolean));
  return cachedDistricts;
}

async function parseDistrictMessage(text: string): Promise<ParsedRequest | null> {
  const validDistricts = await getValidDistricts();

  // "지역: 강남구, 서초구, 송파구" 패턴
  const districtPattern = /(?:지역|구)\s*[:：]\s*(.+)/i;
  const dm = text.match(districtPattern);
  if (dm) {
    const districts = dm[1].split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
    const valid = districts.filter(d => validDistricts.has(d));
    if (valid.length > 0) {
      return { mode: 'district', address: '', radii: [], districts: valid };
    }
  }

  // "강남구 서초구 송파구 견적" 또는 쉼표 구분
  const parts = text.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
  const found: string[] = [];
  for (const p of parts) {
    if (validDistricts.has(p)) found.push(p);
  }
  // 2개 이상 구 이름 → 지역 모드
  if (found.length >= 2) {
    return { mode: 'district', address: '', radii: [], districts: found };
  }

  return null;
}

function parseMessage(text: string): ParsedRequest | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let address = '';
  let radii: number[] = [];
  let advertiserName = '';

  const radiusPattern = /(.+?)[\s,]*(?:기준|반경)\s*(\d+(?:\.\d+)?)\s*(?:[Kk][Mm]|키로|킬로)/;
  const simpleRadiusPattern = /(.+?)\s+(\d+(?:\.\d+)?)\s*(?:[Kk][Mm]|키로|킬로)\s*$/;

  for (const line of lines) {
    const addrMatch = line.match(/주소\s*[:：]\s*(.+)/i);
    if (addrMatch) {
      const full = addrMatch[1].trim();
      const rm = full.match(radiusPattern);
      if (rm) {
        address = rm[1].replace(/[,，]\s*$/, '').trim();
        radii = [parseFloat(rm[2])];
        continue;
      }
      address = full;
      continue;
    }

    const brandMatch = line.match(/포커스미디어\s*[:：]\s*(.+)/i);
    if (brandMatch) {
      advertiserName = brandMatch[1].trim();
      continue;
    }

    if (!address) {
      const rm = line.match(radiusPattern);
      if (rm) {
        address = rm[1].replace(/[,，]\s*$/, '').trim();
        radii = [parseFloat(rm[2])];
        continue;
      }
      const sm = line.match(simpleRadiusPattern);
      if (sm) {
        address = sm[1].trim();
        radii = [parseFloat(sm[2])];
      }
    }
  }

  if (!address) return null;
  if (radii.length === 0) radii = [1, 1.5, 3];

  return { mode: 'radius', address, radii, districts: [], advertiserName: advertiserName || undefined };
}

// ── 오프라인 Geocoding (구 센트로이드) ──

const DISTRICTS: Record<string, { lat: number; lng: number }> = {
  '마포구': { lat: 37.5633, lng: 126.9082 },
  '강남구': { lat: 37.5173, lng: 127.0473 },
  '서초구': { lat: 37.4837, lng: 127.0324 },
  '송파구': { lat: 37.5145, lng: 127.1058 },
  '강서구': { lat: 37.5509, lng: 126.8496 },
  '양천구': { lat: 37.5170, lng: 126.8666 },
  '영등포구': { lat: 37.5264, lng: 126.8963 },
  '구로구': { lat: 37.4954, lng: 126.8875 },
  '금천구': { lat: 37.4568, lng: 126.8955 },
  '관악구': { lat: 37.4783, lng: 126.9516 },
  '동작구': { lat: 37.5124, lng: 126.9392 },
  '성동구': { lat: 37.5633, lng: 127.0367 },
  '광진구': { lat: 37.5384, lng: 127.0822 },
  '중구': { lat: 37.5640, lng: 126.9975 },
  '용산구': { lat: 37.5324, lng: 126.9907 },
  '종로구': { lat: 37.5730, lng: 126.9794 },
  '은평구': { lat: 37.6027, lng: 126.9291 },
  '서대문구': { lat: 37.5791, lng: 126.9368 },
  '강동구': { lat: 37.5301, lng: 127.1238 },
  '성북구': { lat: 37.5894, lng: 127.0167 },
  '동대문구': { lat: 37.5744, lng: 127.0396 },
  '중랑구': { lat: 37.6063, lng: 127.0928 },
  '강북구': { lat: 37.6396, lng: 127.0255 },
  '도봉구': { lat: 37.6688, lng: 127.0471 },
  '노원구': { lat: 37.6543, lng: 127.0568 },
};

function offlineGeocode(address: string): { lat: number; lng: number } | null {
  for (const [gu, coord] of Object.entries(DISTRICTS)) {
    if (address.includes(gu)) return coord;
  }
  return null;
}

async function geocodeAddress(address: string, baseUrl: string): Promise<{
  lat: number; lng: number; resolvedAddress: string; method: string;
} | null> {
  try {
    const resp = await fetch(`${baseUrl}/api/geocode?address=${encodeURIComponent(address)}`);
    if (resp.ok) {
      const data = await resp.json();
      return {
        lat: data.lat,
        lng: data.lng,
        resolvedAddress: data.address || address,
        method: data.method || 'api',
      };
    }
  } catch {
    // API 실패 → 오프라인 시도
  }

  const local = offlineGeocode(address);
  if (local) {
    return {
      lat: local.lat,
      lng: local.lng,
      resolvedAddress: address,
      method: 'offline',
    };
  }

  return null;
}

// ── Webhook 핸들러 ───────────────────

export async function POST(req: NextRequest) {
  const webhookSecret = req.headers.get('x-telegram-bot-api-secret-token');
  if (!TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'TELEGRAM_WEBHOOK_SECRET not configured' }, { status: 500 });
  }
  if (!webhookSecret || webhookSecret !== TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
  }

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
  }

  try {
    const update = await req.json();
    const message = update?.message;
    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // /start 커맨드
    if (text === '/start') {
      await sendMessage(chatId,
        `<b>📍 포커스미디어 견적서 자동생성기</b>\n\n` +
        `아래 형식으로 메시지를 보내주시면 견적서를 자동으로 생성합니다.\n\n` +
        `<b>📝 반경 조회:</b>\n` +
        `<code>마포구 용강동 122-1 기준 2Km</code>\n\n` +
        `<b>🗺️ 지역별 조회:</b>\n` +
        `<code>강남구, 서초구, 송파구</code>\n` +
        `<code>지역: 강남구, 서초구</code>\n\n` +
        `<b>🔹 지원 반경:</b> 0.5, 1, 1.5, 2, 3, 5km\n` +
        `<b>🔹 출력:</b> Excel 견적서 + PDF 링크`
      );
      return NextResponse.json({ ok: true });
    }

    // /help 커맨드
    if (text === '/help') {
      await sendMessage(chatId,
        `<b>📌 사용법</b>\n\n` +
        `<b>1️⃣ 반경 조회</b>\n` +
        `주소와 반경을 입력하세요\n` +
        `예: <code>강남구 역삼동 기준 1.5Km</code>\n\n` +
        `<b>2️⃣ 지역별 조회</b>\n` +
        `구 이름을 쉼표로 구분하세요\n` +
        `예: <code>강남구, 서초구, 송파구</code>\n` +
        `예: <code>지역: 마포구, 용산구</code>\n\n` +
        `3️⃣ 자동으로 주변 아파트를 검색합니다\n` +
        `4️⃣ Excel 견적서 + PDF 링크가 회신됩니다`
      );
      return NextResponse.json({ ok: true });
    }

    // ── 파싱 ─────────────────────────

    // 1. 지역별 모드 감지 (구 이름 2개 이상 또는 "지역:" 패턴)
    let parsed: ParsedRequest | null = await parseDistrictMessage(text);
    let parseMethod = parsed ? '🗺️ 지역별' : '';

    // 2. 반경 모드 (정규식)
    if (!parsed) {
      parsed = parseMessage(text);
      if (parsed) parseMethod = '📝 정규식';
    }

    // 3. AI 폴백
    if (!parsed) {
      const aiResult = await parseWithAI(text);
      if (aiResult && aiResult.address && aiResult.confidence >= 0.5) {
        parsed = {
          mode: 'radius',
          address: aiResult.address,
          radii: aiResult.radii,
          districts: [],
          advertiserName: aiResult.advertiser_name,
        };
        parseMethod = `🤖 AI (${aiResult.model || 'unknown'})`;
      }
    }

    if (!parsed) {
      await sendMessage(chatId,
        `❓ 주소를 인식하지 못했습니다.\n\n` +
        `아래처럼 보내주세요:\n` +
        `• <b>반경:</b> "마포구 용강동 기준 2km"\n` +
        `• <b>지역:</b> "강남구, 서초구, 송파구"\n\n` +
        `/help로 자세한 사용법을 확인하세요.`
      );
      return NextResponse.json({ ok: true });
    }

    // ── 지역별 조회 모드 ────────────────
    if (parsed.mode === 'district') {
      const districtNames = parsed.districts.join(', ');

      await sendMessage(chatId,
        `🔍 <b>지역별 견적 생성 중...</b>\n\n` +
        `🗺️ 지역: ${escapeTelegramHtml(districtNames)}\n` +
        `${parseMethod}\n` +
        `\n잠시만 기다려주세요...`
      );

      const result = await searchByDistrict({
        districts: parsed.districts,
      });

      if (result.total_count === 0) {
        await sendMessage(chatId,
          `📭 검색 결과 없음\n\n` +
          `${escapeTelegramHtml(districtNames)} 지역에 가동 가능한 단지가 없습니다.`
        );
        return NextResponse.json({ ok: true });
      }

      const fmt = (n: number) => n.toLocaleString('ko-KR');
      const summaryLines = result.summaries.map(s =>
        `  · ${escapeTelegramHtml(`${s.city.replace(/특별시|광역시/g, '')} ${s.district}`)}: ${fmt(s.total_units)}대 / ${fmt(s.total_households)}세대`
      ).join('\n');

      await sendMessage(chatId,
        `✅ <b>검색 완료!</b>\n\n` +
        `🗺️ ${escapeTelegramHtml(districtNames)}\n\n` +
        `<b>📊 요약</b>\n` +
        `• 가용 단지: <b>${fmt(result.total_count)}건</b>\n` +
        `• 총 판매수량: <b>${fmt(result.total_units)}대</b>\n` +
        `• 총 세대수: <b>${fmt(result.total_households)}세대</b>\n` +
        `• 4주 총 금액: <b>${fmt(result.total_price_4w)}원</b>\n\n` +
        `<b>📋 지역별</b>\n${summaryLines}\n\n` +
        `📥 견적서 Excel을 전송합니다...`
      );

      const excel = await generateExcel(result, '', '');
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `포커스미디어_견적서_${sanitizeFilenameSegment(districtNames)}_${dateStr}.xlsx`;

      await sendDocument(chatId, excel, filename,
        `📊 ${districtNames} 지역별 견적서`
      );

      // PDF 링크
      const baseUrl = req.nextUrl.origin;
      const pdfParams = new URLSearchParams({
        address: districtNames,
        districts: parsed.districts.join(','),
      });

      await sendMessage(chatId,
        `📄 <b>PDF 견적서</b>\n` +
        `아래 링크에서 PDF로 저장할 수 있습니다:\n` +
        `<a href="${baseUrl}/api/pdf?${pdfParams.toString()}">🔗 견적서 PDF 열기</a>\n\n` +
        `💡 링크 접속 → 브라우저 인쇄(Ctrl+P) → PDF 저장`
      );

      void appendActivityLog({
        action: 'telegram',
        address: districtNames,
        radii: [],
        resultCount: result.total_count,
        advertiserName: '',
        campaignName: '',
        ip: getClientIp(req.headers),
      }).catch(() => {});

      return NextResponse.json({ ok: true });
    }

    // ── 반경 조회 모드 ──────────────────

    await sendMessage(chatId,
      `🔍 <b>견적 생성 중...</b>\n\n` +
      `📍 주소: ${escapeTelegramHtml(parsed.address)}\n` +
      `📐 반경: ${parsed.radii.map(r => `${r}km`).join(', ')}\n` +
      `${parsed.advertiserName ? `🏢 광고주: ${escapeTelegramHtml(parsed.advertiserName)}\n` : ''}` +
      `${parseMethod}\n` +
      `\n잠시만 기다려주세요...`
    );

    // Geocoding
    const baseUrl = req.nextUrl.origin;
    const geo = await geocodeAddress(parsed.address, baseUrl);
    if (!geo) {
      await sendMessage(
        chatId,
        `❌ 주소를 좌표로 변환하지 못했습니다.\n주소를 확인해주세요: <code>${escapeTelegramHtml(parsed.address)}</code>`
      );
      return NextResponse.json({ ok: true });
    }

    // 검색
    const result = await searchNearby({
      address: geo.resolvedAddress,
      lat: geo.lat,
      lng: geo.lng,
      radii: parsed.radii,
    });

    if (result.total_count === 0) {
      await sendMessage(chatId,
        `📭 검색 결과 없음\n\n` +
        `${escapeTelegramHtml(parsed.address)} 기준 ${parsed.radii.join(',')}km 반경에 가동 가능한 단지가 없습니다.`
      );
      return NextResponse.json({ ok: true });
    }

    // 요약 메시지
    const fmt = (n: number) => n.toLocaleString('ko-KR');
    const summaryLines = result.summaries.map(s =>
      `  · ${escapeTelegramHtml(`${s.city.replace(/특별시|광역시/g, '')} ${s.district}`)}: ${fmt(s.total_units)}대 / ${fmt(s.total_households)}세대`
    ).join('\n');

    await sendMessage(chatId,
      `✅ <b>검색 완료!</b>\n\n` +
      `📍 ${escapeTelegramHtml(geo.resolvedAddress)}\n` +
      `📐 반경: ${parsed.radii.map(r => `${r}km`).join(', ')}` +
      `${geo.method === 'offline' ? ' ⚠️근사좌표' : ''}\n\n` +
      `<b>📊 요약</b>\n` +
      `• 가용 단지: <b>${fmt(result.total_count)}건</b>\n` +
      `• 총 판매수량: <b>${fmt(result.total_units)}대</b>\n` +
      `• 총 세대수: <b>${fmt(result.total_households)}세대</b>\n` +
      `• 4주 총 금액: <b>${fmt(result.total_price_4w)}원</b>\n\n` +
      `<b>📋 지역별</b>\n${summaryLines}\n\n` +
      `📥 견적서 Excel을 전송합니다...`
    );

    // Excel 생성 & 전송
    const excel = await generateExcel(result, parsed.advertiserName || '', '');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `포커스미디어_견적서_${sanitizeFilenameSegment(parsed.address)}_${dateStr}.xlsx`;

    await sendDocument(chatId, excel, filename,
      `📊 ${parsed.address} 반경 ${parsed.radii.join(',')}km 견적서`
    );

    // PDF 미리보기 링크
    const pdfParams = new URLSearchParams({
      lat: String(geo.lat),
      lng: String(geo.lng),
      address: geo.resolvedAddress,
      radii: parsed.radii.join(','),
    });

    await sendMessage(chatId,
      `📄 <b>PDF 견적서</b>\n` +
      `아래 링크에서 PDF로 저장할 수 있습니다:\n` +
      `<a href="${baseUrl}/api/pdf?${pdfParams.toString()}">🔗 견적서 PDF 열기</a>\n\n` +
      `💡 링크 접속 → 브라우저 인쇄(Ctrl+P) → PDF 저장`
    );

    void appendActivityLog({
      action: 'telegram',
      address: geo.resolvedAddress,
      radii: parsed.radii,
      resultCount: result.total_count,
      advertiserName: parsed.advertiserName || '',
      campaignName: '',
      ip: getClientIp(req.headers),
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}
