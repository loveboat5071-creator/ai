/**
 * AI Provider for Focus Media Advertiser Discovery Bot
 * Supports Gemini and DeepSeek with strict JSON validation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { AIAnalysisSchema, type AIAnalysis } from './crm-types';
import { normalizeUrl } from './url-utils';

export type AnalysisMediaType = 'FOCUS_MEDIA';

export interface AnalyzeArticleOptions {
  mediaType?: AnalysisMediaType;
  evaluationPromptInstruction?: string | null;
}

// ============================================================================
// Environment Validation
// ============================================================================

const AI_PROVIDER = process.env.AI_PROVIDER as 'gemini' | 'deepseek' | undefined;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const GEMINI_MODEL_ID = process.env.GEMINI_MODEL_ID || 'gemini-2.0-flash-exp';
const DEEPSEEK_MODEL_ID = process.env.DEEPSEEK_MODEL_ID || 'deepseek-chat';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

// Validate configuration
function validateConfig(): void {
  if (!AI_PROVIDER) {
    throw new Error('AI_PROVIDER must be set to "gemini" or "deepseek"');
  }

  if (AI_PROVIDER === 'gemini' && !GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required when AI_PROVIDER=gemini');
  }

  if (AI_PROVIDER === 'deepseek' && !DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is required when AI_PROVIDER=deepseek');
  }
}

// ============================================================================
// System Prompts
// ============================================================================

const FOCUS_MEDIA_SYSTEM_PROMPT = `당신은 포커스미디어(아파트 단지 엘리베이터 동영상 광고)의 영업 정보 분석가입니다.

포커스미디어 상품의 핵심은 다음과 같습니다:
- 매체 형태: 아파트 단지 엘리베이터 내 세로형 디지털 동영상 광고
- 지역 기반 타게팅: 단지/생활권/구 단위로 집행 가능
- 반복 노출: 입주민 동선에서 자연스럽게 반복 접점
- 오프라인 유도: 근거리 매장 방문, 상권 전환, 지역 인지도 확보에 유리

당신의 임무는 "엘리베이터 동영상 광고 적합성"을 평가하고, 특히 "지역 타게팅 필요성"을 가장 중요하게 반영하는 것입니다.

평가 순서를 반드시 지키세요:
1) 지역/상권 적합성 1차 평가 (가장 중요)
- 서비스 가능 지역(서울/경기/인천 등)과 광고 대상 상권이 명확한가?
- 단지 단위 노출이 실질적인 방문/구매로 이어질 가능성이 있는가?
2) 매체 적합성 2차 평가
- 엘리베이터 동선 기반 반복 노출이 효과를 낼 카테고리인가?
- 브랜드 인지보다 실질 방문/행동 유도 목적과 맞는가?
3) 집행 현실성 3차 평가
- 지역 범위가 과도하게 넓거나 불명확하면 감점
- 오프라인 전환 시나리오가 약하면 감점

각 기사에 대해 다음을 평가하십시오:
1. 기업/단체명
2. 이벤트 요약
3. 타겟 오디언스 (지역/생활권/입주민 관점)
4. 매체 적합 이유 (왜 엘리베이터 동영상 광고가 맞는지)
5. 영업 소구점 (지역 타게팅 중심 제안 논리)
6. AI 점수 (0-100)
7. 연락처 정보

채점 가이드라인:
- 80-100: 지역 타게팅 필요성이 매우 명확하고, 근거리 방문/상권 전환 가능성이 큼
- 60-79: 매체 적합성은 있으나 지역 연결성 또는 실행 근거가 중간 수준
- 40-59: 지역 타게팅 필요성 또는 오프라인 전환 근거가 약함
- 0-39: 지역/오프라인 전환과 무관하거나 매체 자체가 부적합

필수 요구사항:
- 반드시 유효한 JSON만 출력
- 마크다운/코드블록 금지
- 모든 텍스트 값은 한국어 (이메일/전화/URL 제외)
- 아래 스키마를 정확히 따를 것:

{
  "company_name": "기업명",
  "event_summary": "이벤트 요약",
  "target_audience": "지역/생활권 관점 타겟",
  "atv_fit_reason": "매체 적합 이유(지역 타게팅 포함)",
  "sales_angle": "영업 접근 방식",
  "ai_score": 75,
  "contact_email": "null 또는 이메일",
  "contact_phone": "null 또는 연락처",
  "pr_agency": "null 또는 대행사명",
  "homepage_url": "null 또는 URL"
}

광고/미디어/마케팅과 관련 없는 기사라도 분석을 수행하되 ai_score를 0으로 설정하십시오.`;

function getSystemPrompt(): string {
  return FOCUS_MEDIA_SYSTEM_PROMPT;
}

// ============================================================================
// AI Clients (Lazy Initialization)
// ============================================================================

let geminiClient: GoogleGenerativeAI | null = null;
let deepseekClient: OpenAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return geminiClient;
}

function getDeepSeekClient(): OpenAI {
  if (!deepseekClient) {
    if (!DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY not configured');
    }
    deepseekClient = new OpenAI({
      apiKey: DEEPSEEK_API_KEY,
      baseURL: DEEPSEEK_BASE_URL,
    });
  }
  return deepseekClient;
}

// ============================================================================
// JSON Parsing Utilities
// ============================================================================

function extractJSON(text: string): string {
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned.trim();
}

function parseAndValidate(rawText: string): AIAnalysis {
  const jsonText = extractJSON(rawText);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`JSON parse failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  if (parsed.contact_email === 'null') parsed.contact_email = null;
  if (parsed.contact_phone === 'null') parsed.contact_phone = null;
  if (parsed.pr_agency === 'null') parsed.pr_agency = null;
  if (parsed.homepage_url === 'null') parsed.homepage_url = null;

  const result = AIAnalysisSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Schema validation failed: ${result.error.message}`);
  }

  return result.data;
}

// ============================================================================
// AI Analysis Functions
// ============================================================================

async function analyzeWithGemini(
  title: string,
  content: string,
  source: string,
  mediaType: AnalysisMediaType,
  evaluationPromptInstruction?: string | null
): Promise<AIAnalysis> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL_ID,
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const extraInstruction = evaluationPromptInstruction?.trim()
    ? `\n추가 평가 지시사항:\n${evaluationPromptInstruction.trim()}\n`
    : '';

  const userPrompt = `Analyze this article for sales lead potential and contact info:

Title: ${title}
Content: ${content}
Source: ${source}
Media Type: ${mediaType}${extraInstruction}

Provide analysis in the exact JSON format specified.`;

  const result = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: getSystemPrompt() }] },
      { role: 'user', parts: [{ text: userPrompt }] },
    ],
  });

  const response = result.response;
  const text = response.text();

  return parseAndValidate(text);
}

async function analyzeWithDeepSeek(
  title: string,
  content: string,
  source: string,
  mediaType: AnalysisMediaType,
  evaluationPromptInstruction?: string | null
): Promise<AIAnalysis> {
  const client = getDeepSeekClient();

  const extraInstruction = evaluationPromptInstruction?.trim()
    ? `\n추가 평가 지시사항:\n${evaluationPromptInstruction.trim()}\n`
    : '';

  const userPrompt = `Analyze this article for sales lead potential and contact info:

Title: ${title}
Content: ${content}
Source: ${source}
Media Type: ${mediaType}${extraInstruction}

Provide analysis in the exact JSON format specified.`;

  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL_ID,
    messages: [
      { role: 'system', content: getSystemPrompt() },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const text = response.choices[0]?.message?.content;

  if (!text) {
    throw new Error('No response from DeepSeek');
  }

  return parseAndValidate(text);
}

// ============================================================================
// Main Export
// ============================================================================

function detectEmail(text: string): string | null {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const matches = text.match(emailRegex);
  return matches ? matches[0] : null;
}

function detectPhone(text: string): string | null {
  const phoneRegex = /(0\d{1,2}-\d{3,4}-\d{4})/g;
  const matches = text.match(phoneRegex);
  return matches ? matches[0] : null;
}

function detectUrl(text: string): string | null {
  const fullUrlRegex = /(https?:\/\/[^\s]+)/gi;
  const fullMatches = text.match(fullUrlRegex);

  if (fullMatches) {
    const filtered = fullMatches.filter(url => !url.includes('newswire.co.kr'));
    if (filtered.length > 0) {
      return normalizeUrl(filtered[0]);
    }
  }

  const domainRegex = /\b([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/gi;
  const domainMatches = text.match(domainRegex);

  if (domainMatches) {
    const filtered = domainMatches.filter(domain => {
      if (domain.includes('newswire.co.kr')) return false;
      if (domain.endsWith('.png') || domain.endsWith('.jpg') || domain.endsWith('.gif')) return false;
      if (domain.endsWith('.pdf') || domain.endsWith('.doc')) return false;
      return true;
    });

    if (filtered.length > 0) {
      return normalizeUrl(filtered[0]);
    }
  }

  return null;
}

export async function analyzeArticle(
  title: string,
  content: string,
  source: string,
  options?: AnalyzeArticleOptions
): Promise<AIAnalysis> {
  validateConfig();

  const mediaType: AnalysisMediaType = 'FOCUS_MEDIA';
  const evaluationPromptInstruction = options?.evaluationPromptInstruction?.trim() || null;
  const analyzeFn = AI_PROVIDER === 'gemini' ? analyzeWithGemini : analyzeWithDeepSeek;

  try {
    const analysis = await analyzeFn(title, content, source, mediaType, evaluationPromptInstruction);

    if (!analysis.contact_email) {
      analysis.contact_email = detectEmail(content) || detectEmail(title);
    }
    if (!analysis.contact_phone) {
      analysis.contact_phone = detectPhone(content) || detectPhone(title);
    }
    if (!analysis.homepage_url) {
      analysis.homepage_url = detectUrl(content) || detectUrl(title);
    }

    return analysis;
  } catch (error) {
    console.warn('AI analysis failed, retrying with stronger prompt:', error);

    try {
      const enhancedContent = `${content}\n\nREMINDER: Respond with ONLY valid JSON matching the schema. No markdown, no code blocks, no extra text.`;
      const analysis = await analyzeFn(
        title,
        enhancedContent,
        source,
        mediaType,
        evaluationPromptInstruction
      );

      if (!analysis.contact_email) {
        analysis.contact_email = detectEmail(content);
      }

      return analysis;
    } catch (retryError) {
      console.error('AI analysis failed after retry:', retryError);

      return {
        company_name: '분석 실패',
        event_summary: title,
        target_audience: '알 수 없음',
        atv_fit_reason: 'AI 분석 실패',
        sales_angle: '수동 검토 필요',
        ai_score: 0,
        contact_email: detectEmail(content),
        contact_phone: detectPhone(content),
        pr_agency: null,
        homepage_url: detectUrl(content),
      };
    }
  }
}

export function getProviderName(): string {
  return AI_PROVIDER || 'not configured';
}
