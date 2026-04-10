/**
 * 이메일 초안 생성 API — DeepSeek AI로 영업 이메일 초안 생성
 * MINING_API_KEY로 출처 검증 (FocusMap 전용)
 */
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const MINING_API_KEY = process.env.MINING_API_KEY;

function getDeepseekClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }
  return new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey,
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Mining-Key',
  };
}

function verifyMiningKey(req: NextRequest): boolean {
  if (!MINING_API_KEY) return true;
  const key = req.headers.get('x-mining-key') || '';
  return key === MINING_API_KEY;
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyMiningKey(req)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mining API key' },
        { status: 403, headers: corsHeaders() }
      );
    }

    const body = await req.json();
    const {
      businessName,
      category,
      region,
      phone,
      address,
      homepageUrl,
      companyOverview,
      keyServices,
      recipientEmail,
    } = body;

    if (!businessName || !category || !region) {
      return NextResponse.json(
        { success: false, error: 'businessName, category, region are required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const deepseek = getDeepseekClient();

    const prompt = `
당신은 **포커스미디어 아파트 단지 엘리베이터 동영상 광고 영업 전문가**입니다.
다음 업체에게 보낼 영업 이메일 초안을 작성하세요.

**포커스미디어 서비스**: 아파트 단지 엘리베이터 내 동영상 광고 (지역 타겟팅 중심)
- 특정 지역(동/구 단위)의 아파트 단지 엘리베이터에서 반복 노출
- 주민 생활동선 내 자연스러운 광고 노출
- 지역 밀착형 업체에 최적화된 광고 매체

**대상 업체 정보**:
- 업체명: ${businessName}
- 업종: ${category}
- 지역: ${region}
- 주소: ${address || '미확인'}
- 전화: ${phone || '미확인'}
- 홈페이지: ${homepageUrl || '미확인'}
- 기업 소개: ${companyOverview || '미확인'}
- 주요 서비스: ${keyServices?.join(', ') || '미확인'}
- 수신자 이메일: ${recipientEmail || '미확인'}

**작성 규칙**:
1. 제목은 흥미를 끌되 과하지 않게
2. 본문은 격식 있되 친근한 톤 (존댓말)
3. 해당 업종에 왜 엘리베이터 광고가 효과적인지 구체적으로 설명
4. 해당 지역의 아파트 주민이 잠재 고객임을 언급
5. 간단한 CTA (미팅/통화 제안)
6. 전체 분량은 적절하게 (너무 길지 않게)

**JSON 형식으로 응답**:
{
  "subject": "이메일 제목",
  "body": "이메일 본문 (줄바꿈은 \\n 사용)",
  "summary": "이 초안의 핵심 포인트 1줄 요약"
}
`;

    const completion = await deepseek.chat.completions.create({
      messages: [
        {
          role: 'system',
          content:
            'You are a professional B2B sales email writer for Focus Media elevator advertising. Write in Korean. Output valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0].message.content || '{}';
    let draft;
    try {
      draft = JSON.parse(content);
    } catch {
      draft = {
        subject: `[포커스미디어] ${businessName}님, ${region} 아파트 주민 대상 광고 제안`,
        body: `안녕하세요, ${businessName} 관계자님.\n\n포커스미디어입니다. ${region} 지역 아파트 엘리베이터 동영상 광고를 통해 ${category} 업종의 효과적인 지역 마케팅을 제안드립니다.\n\n관심이 있으시면 편하신 시간에 연락 부탁드립니다.\n\n감사합니다.`,
        summary: 'AI 분석 실패로 기본 템플릿 사용',
      };
    }

    return NextResponse.json(
      {
        success: true,
        draft,
      },
      { headers: corsHeaders() }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Draft generation failed: ${message}` },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}
