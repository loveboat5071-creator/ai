/**
 * AI 주소 파싱 — Gemini Flash / DeepSeek 듀얼
 * 
 * 우선순위: Gemini Flash → DeepSeek → null
 * 환경변수: GEMINI_API_KEY, DEEPSEEK_API_KEY
 */

export interface ParsedRequest {
  address: string;
  radii: number[];
  advertiser_name?: string;
  campaign_name?: string;
  industry?: string;
  confidence: number;
  original: string;
  model?: string;
}

const SYSTEM_PROMPT = `당신은 한국의 아파트 엘리베이터 광고 견적서 생성기의 주소 파서입니다.
사용자 메시지에서 다음 정보를 추출해 JSON으로 반환하세요:

{
  "address": "서울특별시 마포구 용강동 122-1",
  "radii": [1, 1.5, 3],
  "advertiser_name": "ABC의원",
  "campaign_name": "봄 캠페인",
  "industry": "치과",
  "confidence": 0.9
}

규칙:
- 주소가 "마포구 용강동" 처럼 간략하면, "서울특별시 마포구 용강동"으로 보완
- "2km", "2키로", "반경 2km" → radii에 추가
- "1~3km" → [1, 2, 3]
- 반경 언급이 없으면 기본 [1, 1.5, 3]
- "상암 MBC 앞", "강남역 근처" 같은 랜드마크도 주소로 변환 시도
- industry는 아래 목록 중에서만: 내과, 부동산, 비뇨기과, 산부인과, 안과, 외과, 이비인후과, 정신건강의학과, 종합병원, 치과, 피부과, 한의원
- JSON만 반환, 다른 텍스트 없이`;

/** Gemini Flash */
async function parseWithGemini(message: string): Promise<ParsedRequest | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n사용자 메시지: ${message}` }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512, responseMimeType: 'application/json' },
        }),
      }
    );
    if (!resp.ok) { console.error(`Gemini error: ${resp.status}`); return null; }
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const p = JSON.parse(text);
    return { address: p.address || '', radii: p.radii || [1, 1.5, 3], advertiser_name: p.advertiser_name, campaign_name: p.campaign_name, industry: p.industry, confidence: p.confidence || 0.5, original: message, model: 'gemini' };
  } catch (e) { console.error('Gemini parse error:', e); return null; }
}

/** DeepSeek (OpenAI 호환) */
async function parseWithDeepSeek(message: string): Promise<ParsedRequest | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  try {
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
        temperature: 0.1,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
    });
    if (!resp.ok) { console.error(`DeepSeek error: ${resp.status}`); return null; }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return null;
    const p = JSON.parse(text);
    return { address: p.address || '', radii: p.radii || [1, 1.5, 3], advertiser_name: p.advertiser_name, campaign_name: p.campaign_name, industry: p.industry, confidence: p.confidence || 0.5, original: message, model: 'deepseek' };
  } catch (e) { console.error('DeepSeek parse error:', e); return null; }
}

/**
 * AI 파싱 (Gemini → DeepSeek 폴백)
 */
export async function parseWithAI(message: string): Promise<ParsedRequest | null> {
  // Gemini 먼저
  const gemini = await parseWithGemini(message);
  if (gemini && gemini.address && gemini.confidence >= 0.5) return gemini;

  // DeepSeek 폴백
  const deepseek = await parseWithDeepSeek(message);
  if (deepseek && deepseek.address && deepseek.confidence >= 0.5) return deepseek;

  return null;
}
