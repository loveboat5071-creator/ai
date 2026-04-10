import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { redis } from '@/lib/redis';
import { RedisKeys, type LeadCore } from '@/lib/crm-types';
import { scrapeHomepage } from '@/lib/web-scraper';
import {
  applyHomepageEnrichmentToLead,
  shouldRefreshHomepageEnrichment,
} from '@/lib/lead-enrichment';

export const dynamic = 'force-dynamic';

function getDeepseekClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  });
}

interface EmailTemplate {
  id: string;
  name: string;
  mediaType: 'FOCUS_MEDIA';
  instruction: string;
}

interface SalesConfig {
  emailTemplates?: EmailTemplate[];
  defaultEmailTemplateIds?: {
    FOCUS_MEDIA?: string;
  };
}

interface GenerateEmailRequest {
  templateId?: string;
  prompt?: string;
}

const DEFAULT_TEMPLATE: EmailTemplate = {
  id: 'focus_region_targeting',
  name: '포커스미디어 지역 타게팅',
  mediaType: 'FOCUS_MEDIA',
  instruction: [
    '아파트 단지 엘리베이터 동영상 광고 제안 구조로 작성하세요.',
    '지역 타게팅 중요성을 핵심 논리로 강조하세요.',
    '오프라인 방문 유도 및 상권 전환 가능성을 구체적으로 제시하세요.',
  ].join('\n'),
};

function fillTemplate(text: string, lead: LeadCore): string {
  const vars: Record<string, string> = {
    company_name: lead.ai_analysis.company_name || '',
    event_summary: lead.ai_analysis.event_summary || '',
    target_audience: lead.ai_analysis.target_audience || '',
    sales_angle: lead.ai_analysis.sales_angle || '',
    atv_fit_reason: lead.ai_analysis.atv_fit_reason || '',
    homepage_url: lead.ai_analysis.homepage_url || '',
  };

  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => vars[key] || '');
}

function buildEnrichmentSection(lead: LeadCore): string[] {
  const enrichment = lead.enrichment;
  const fallbackEmail = lead.ai_analysis.contact_email || '미확인';
  const fallbackPhone = lead.ai_analysis.contact_phone || '미확인';

  if (!enrichment) {
    return [
      '[홈페이지 크롤링 인사이트]',
      '- 크롤링 데이터 없음',
      `- 연락처(기사 기준): 이메일 ${fallbackEmail}, 전화 ${fallbackPhone}`,
      '',
    ];
  }

  const keyServices = (enrichment.key_services || []).slice(0, 4).join(' | ') || '미확인';
  const keyMessages = (enrichment.key_messages || []).slice(0, 4).join(' | ') || '미확인';
  const snippets = (enrichment.evidence_snippets || []).slice(0, 3).join(' / ') || '미확인';
  const contactEmail = enrichment.primary_email || enrichment.emails?.[0] || fallbackEmail;
  const contactPhone = enrichment.primary_phone || enrichment.phones?.[0] || fallbackPhone;
  const pages = enrichment.pages_crawled || 0;
  const confidence = enrichment.contact_confidence || 'LOW';
  const status = enrichment.success ? '성공' : `실패(${enrichment.error || 'unknown'})`;

  return [
    '[홈페이지 크롤링 인사이트]',
    `- 크롤링 상태: ${status}`,
    `- 크롤링 페이지 수: ${pages}`,
    `- 기업 소개: ${enrichment.company_overview || enrichment.description || '미확인'}`,
    `- 주요 서비스/제품: ${keyServices}`,
    `- 핵심 메시지: ${keyMessages}`,
    `- 근거 문장: ${snippets}`,
    `- 우선 연락처: 이메일 ${contactEmail}, 전화 ${contactPhone}, 신뢰도 ${confidence}`,
    '',
  ];
}

function buildPrompt(lead: LeadCore, template: EmailTemplate): string {
  const solutionLabel = '엘리베이터 동영상 광고';
  const structure = '문제 제기 -> 지역/상권 공감 -> 솔루션 제시(포커스미디어 엘리베이터TV) -> 미팅 제안';
  const templateInstruction = fillTemplate(template.instruction, lead);
  const enrichmentLines = buildEnrichmentSection(lead);
  return [
    '[역할]',
    '당신은 B2B 전문 세일즈 카피라이터입니다. 정중하고 설득력 있는 톤앤매너를 유지하세요.',
    '',
    '[상황]',
    `저는 WS미디어의 미디어 컨설턴트입니다. 현재 "${lead.ai_analysis.company_name}"의 마케팅 담당자에게 포커스미디어 엘리베이터TV 광고 상품을 제안하려 합니다.`,
    '',
    '[타겟 기업 정보]',
    `- 기업명: ${lead.ai_analysis.company_name}`,
    `- 최근 이슈: ${lead.ai_analysis.event_summary}`,
    `- 예상 타겟: ${lead.ai_analysis.target_audience}`,
    '',
    '[제안 핵심 논리]',
    `${lead.ai_analysis.sales_angle}`,
    '',
    ...enrichmentLines,
    '[템플릿 지시사항]',
    templateInstruction,
    '',
    '[요청사항]',
    '1) 먼저 클릭을 유도하는 메일 제목 후보 3개를 작성하세요.',
    `2) 본문은 ${structure} 구조로 작성하세요.`,
    '3) 홈페이지 크롤링 인사이트가 있으면 본문에 반드시 1~2개 사실 기반 문장을 자연스럽게 반영하세요.',
    '4) 확인되지 않은 내용은 지어내지 말고, 제공된 근거만 사용하세요.',
    '5) 지역 타게팅 중요도(서울/경기/인천, 생활권, 아파트 단지 단위)를 반드시 본문에 포함하세요.',
    `6) ${solutionLabel}의 실행 장점을 구체 문장으로 1개 이상 제시하세요.`,
    '7) 마크다운이나 특수 포맷 없이 순수 텍스트로 작성하세요.',
    '8) 결과는 다음 형식으로만 반환하세요:',
    'subject_1: ...',
    'subject_2: ...',
    'subject_3: ...',
    '',
    'body:',
    '...'
  ].join('\n');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const deepseek = getDeepseekClient();
    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: 'DEEPSEEK_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const { leadId } = await params;

    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as GenerateEmailRequest;
    const lead = await redis.get<LeadCore>(RedisKeys.leadCore(leadId));
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    let workingLead = lead;
    let enrichmentRefreshed = false;

    if (workingLead.ai_analysis.homepage_url && shouldRefreshHomepageEnrichment(workingLead)) {
      const scrapedInfo = await scrapeHomepage(workingLead.ai_analysis.homepage_url, 12000, { maxPages: 5 });
      workingLead = applyHomepageEnrichmentToLead(workingLead, scrapedInfo);
      await redis.set(RedisKeys.leadCore(leadId), workingLead);
      enrichmentRefreshed = true;
    }

    const config = await redis.get<SalesConfig>(RedisKeys.config());
    const fallbackTemplates = [DEFAULT_TEMPLATE];
    const templates =
      Array.isArray(config?.emailTemplates) && config.emailTemplates.length > 0
        ? config.emailTemplates.filter((item) => item.mediaType === 'FOCUS_MEDIA')
        : fallbackTemplates;
    const selectedTemplateId =
      body.templateId ||
      config?.defaultEmailTemplateIds?.FOCUS_MEDIA ||
      templates[0]?.id ||
      fallbackTemplates[0].id;
    const selectedTemplate =
      templates.find((item) => item.id === selectedTemplateId) || templates[0] || fallbackTemplates[0];

    const model = process.env.DEEPSEEK_MODEL_ID || 'deepseek-chat';
    const userPrompt =
      typeof body.prompt === 'string' && body.prompt.trim()
        ? body.prompt.trim()
        : buildPrompt(workingLead, selectedTemplate);

    const response = await deepseek.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: '당신은 한국 기업 대상 B2B 영업 이메일 작성 전문가입니다. 반드시 한국어 순수 텍스트로만 답하세요.',
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 900,
    });

    const draft = response.choices[0]?.message?.content?.trim();

    if (!draft) {
      return NextResponse.json(
        { error: 'Failed to generate email draft' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      leadId,
      model,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      enrichmentRefreshed,
      enrichmentUsed: Boolean(workingLead.enrichment),
      promptOverridden: Boolean(body.prompt && body.prompt.trim()),
      draft,
      generatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error generating email draft:', error);
    return NextResponse.json(
      { error: 'Failed to generate email draft' },
      { status: 500 }
    );
  }
}
