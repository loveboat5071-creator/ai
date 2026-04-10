import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { RedisKeys } from '@/lib/crm-types';

export const dynamic = 'force-dynamic';

const MASKED_SECRET = '********';
const MAX_KEYWORDS = 20;
const MAX_RSS_FEEDS = 30;
const MAX_EXCLUDED_COMPANIES = 200;
const MAX_TEMP_EXCLUDED_COMPANIES = 300;

interface RSSFeed {
  category: string;
  originalUrl: string;
  url: string;
  title: string;
  enabled?: boolean;
}

interface EmailTemplate {
  id: string;
  name: string;
  mediaType: 'FOCUS_MEDIA';
  instruction: string;
}

interface EvaluationPrompt {
  id: string;
  name: string;
  mediaType: 'FOCUS_MEDIA';
  instruction: string;
}

interface ConfigData {
  naverClientId: string;
  naverClientSecret: string;
  naverEnabled?: boolean;
  naverDaysWindow?: number;
  rssDaysWindow?: number;
  keywords: string[];
  rssFeeds: RSSFeed[];
  minScore?: number;
  leadNotificationsEnabled?: boolean;
  minLeadScoreForNotify?: number;
  excludedCompanies?: string[];
  excludedCompaniesTemporary?: Array<{ name: string; expiresAt: number }>;
  emailTemplates?: EmailTemplate[];
  defaultEmailTemplateId?: string;
  defaultEmailTemplateIds?: {
    FOCUS_MEDIA?: string;
  };
  evaluationPrompts?: EvaluationPrompt[];
  defaultEvaluationPromptIds?: {
    FOCUS_MEDIA?: string;
  };
  updated_at?: string;
}

function stripLegacyScoringFields(data?: ConfigData | null): ConfigData | null {
  if (!data) return null;
  const {
    target_industries: _legacyTargetIndustries,
    avoid_industries: _legacyAvoidIndustries,
    min_score_threshold: _legacyMinScoreThreshold,
    ...rest
  } = data as ConfigData & {
    target_industries?: string[];
    avoid_industries?: string[];
    min_score_threshold?: number;
  };
  return rest;
}

const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'focus_region_targeting',
    name: '포커스미디어 지역 타게팅',
    mediaType: 'FOCUS_MEDIA',
    instruction: [
      '아파트 단지 엘리베이터 동영상 광고 관점에서 작성하세요.',
      '지역/상권/입지(구 단위, 생활권) 타게팅의 필요성을 본문 핵심 논리로 반영하세요.',
      '오프라인 방문 유도, 근거리 도달, 반복 노출의 장점을 구체 문장으로 작성하세요.',
    ].join('\n'),
  },
];

const DEFAULT_EVALUATION_PROMPTS: EvaluationPrompt[] = [
  {
    id: 'focus_default',
    name: '포커스미디어 기본 평가',
    mediaType: 'FOCUS_MEDIA',
    instruction: [
      '아파트 단지 엘리베이터 동영상 광고 적합성을 평가하세요.',
      '지역 타게팅(서울/경기/인천, 생활권, 아파트 밀집도)을 가장 중요하게 반영하세요.',
      '근거리 방문/상권 매출 연결 가능성이 낮으면 점수를 낮추세요.',
    ].join('\n'),
  },
];

const DEFAULT_KEYWORDS: string[] = [
  '신제품 출시',
  '서비스 출시',
  '브랜드 런칭',
  '투자 유치',
  '시리즈 A',
  '시리즈 B',
  '마케팅 캠페인',
  '광고 캠페인',
  'CF 공개',
  '엠버서더 발탁',
  '플랫폼 출시',
  '앱 출시',
  '글로벌 진출',
  '한국 진출',
  '파트너십 체결',
  'MOU 체결',
  '리브랜딩',
  '신규 진출',
  '사업 확장',
  '대규모 캠페인',
];

function parseEnvKeywords(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, MAX_KEYWORDS);
}

function sanitizeEmailTemplates(templates: unknown): EmailTemplate[] {
  const rawTemplates = Array.isArray(templates) ? templates : [];
  const seen = new Set<string>();

  return rawTemplates
    .map((item: unknown) => {
      const template = item as {
        id?: unknown;
        name?: unknown;
        mediaType?: unknown;
        instruction?: unknown;
      };
      const normalized: EmailTemplate = {
        id: typeof template.id === 'string' ? template.id.trim() : '',
        name: typeof template.name === 'string' ? template.name.trim() : '',
        mediaType:
          'FOCUS_MEDIA',
        instruction:
          typeof template.instruction === 'string'
            ? template.instruction.trim()
            : '',
      };
      return normalized;
    })
    .filter((item) => item.id && item.name && item.instruction)
    .filter((item) => {
      const key = item.id.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

function sanitizeEvaluationPrompts(prompts: unknown): EvaluationPrompt[] {
  const rawPrompts = Array.isArray(prompts) ? prompts : [];
  const seen = new Set<string>();

  return rawPrompts
    .map((item: unknown) => {
      const prompt = item as {
        id?: unknown;
        name?: unknown;
        mediaType?: unknown;
        instruction?: unknown;
      };
      const normalized: EvaluationPrompt = {
        id: typeof prompt.id === 'string' ? prompt.id.trim() : '',
        name: typeof prompt.name === 'string' ? prompt.name.trim() : '',
        mediaType: 'FOCUS_MEDIA',
        instruction:
          typeof prompt.instruction === 'string'
            ? prompt.instruction.trim()
            : '',
      };
      return normalized;
    })
    .filter((item) => item.id && item.name && item.instruction)
    .filter((item) => {
      const key = item.id.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 30);
}

function mergeDefaultEmailTemplates(templates: unknown): EmailTemplate[] {
  const sanitized = sanitizeEmailTemplates(templates);
  const existingIds = new Set(sanitized.map((item) => item.id.toLowerCase()));
  const merged = [...sanitized];

  for (const defaultTemplate of DEFAULT_EMAIL_TEMPLATES) {
    if (!existingIds.has(defaultTemplate.id.toLowerCase())) {
      merged.push(defaultTemplate);
    }
  }

  return merged.slice(0, 20);
}

function mergeDefaultEvaluationPrompts(prompts: unknown): EvaluationPrompt[] {
  const sanitized = sanitizeEvaluationPrompts(prompts);
  const existingIds = new Set(sanitized.map((item) => item.id.toLowerCase()));
  const merged = [...sanitized];

  for (const defaultPrompt of DEFAULT_EVALUATION_PROMPTS) {
    if (!existingIds.has(defaultPrompt.id.toLowerCase())) {
      merged.push(defaultPrompt);
    }
  }

  return merged.slice(0, 30);
}

function resolveDefaultTemplateIds(templates: EmailTemplate[], requested?: ConfigData['defaultEmailTemplateIds']) {
  return {
    FOCUS_MEDIA:
      requested?.FOCUS_MEDIA &&
      templates.some((item) => item.id === requested.FOCUS_MEDIA)
        ? requested.FOCUS_MEDIA
        : templates[0]?.id || DEFAULT_EMAIL_TEMPLATES[0].id,
  };
}

function resolveDefaultEvaluationPromptIds(
  prompts: EvaluationPrompt[],
  requested?: ConfigData['defaultEvaluationPromptIds']
) {
  return {
    FOCUS_MEDIA:
      requested?.FOCUS_MEDIA &&
      prompts.some((item) => item.id === requested.FOCUS_MEDIA)
        ? requested.FOCUS_MEDIA
        : prompts[0]?.id || DEFAULT_EVALUATION_PROMPTS[0].id,
  };
}

/**
 * GET /api/sales/config
 * Returns config with masked secret
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryMinScore = searchParams.get('minScore');
    const envNaverClientId =
      (process.env.NAVER_CLIENT_ID || process.env.NAVER_CLIENTID || '').trim();
    const envNaverClientSecret =
      (process.env.NAVER_CLIENT_SECRET || process.env.NAVER_CLIENTSECRET || '').trim();
    const envKeywords = parseEnvKeywords(process.env.NAVER_KEYWORDS);

    const rawData = await redis.get<ConfigData>(RedisKeys.config());
    const data = stripLegacyScoringFields(rawData);

    if (!data) {
      return NextResponse.json({
        naverClientId: envNaverClientId || '',
        naverClientSecret: envNaverClientSecret ? MASKED_SECRET : '',
        naverEnabled: true,
        naverDaysWindow: 3,
        rssDaysWindow: 7,
        keywords: envKeywords.length > 0 ? envKeywords : DEFAULT_KEYWORDS,
        rssFeeds: DEFAULT_RSS_FEEDS,
        minScore: 50,
        leadNotificationsEnabled: true,
        minLeadScoreForNotify: 70,
        excludedCompanies: [],
        excludedCompaniesTemporary: [],
        emailTemplates: DEFAULT_EMAIL_TEMPLATES,
        defaultEmailTemplateIds: resolveDefaultTemplateIds(DEFAULT_EMAIL_TEMPLATES),
        evaluationPrompts: DEFAULT_EVALUATION_PROMPTS,
        defaultEvaluationPromptIds: resolveDefaultEvaluationPromptIds(DEFAULT_EVALUATION_PROMPTS),
      });
    }

    // One-time migration: remove deprecated AI scoring fields from persisted config.
    const rawDataObj = rawData as unknown as Record<string, unknown> | null;
    if (
      rawDataObj &&
      ('target_industries' in rawDataObj ||
        'avoid_industries' in rawDataObj ||
        'min_score_threshold' in rawDataObj)
    ) {
      await redis.set(RedisKeys.config(), data);
    }

    const mergedTemplates = mergeDefaultEmailTemplates(data.emailTemplates);
    const mergedEvaluationPrompts = mergeDefaultEvaluationPrompts(data.evaluationPrompts);
    const resolvedDefaultTemplateIds = resolveDefaultTemplateIds(
      mergedTemplates,
      data.defaultEmailTemplateIds || (data.defaultEmailTemplateId ? { FOCUS_MEDIA: data.defaultEmailTemplateId } : undefined)
    );
    const resolvedDefaultEvaluationPromptIds = resolveDefaultEvaluationPromptIds(
      mergedEvaluationPrompts,
      data.defaultEvaluationPromptIds
    );
    const resolvedNaverClientId = data.naverClientId || envNaverClientId;
    const resolvedNaverClientSecret = data.naverClientSecret || envNaverClientSecret;
    const resolvedKeywords =
      data.keywords && data.keywords.length > 0
        ? data.keywords
        : (envKeywords.length > 0 ? envKeywords : DEFAULT_KEYWORDS);

    // Never return raw secret
    return NextResponse.json({
      ...data,
      naverClientId: resolvedNaverClientId || '',
      naverClientSecret: resolvedNaverClientSecret ? MASKED_SECRET : '',
      naverEnabled: data.naverEnabled ?? true,
      naverDaysWindow: data.naverDaysWindow ?? 3,
      rssDaysWindow: data.rssDaysWindow ?? 7,
      keywords: resolvedKeywords,
      rssFeeds: (data.rssFeeds?.length ? data.rssFeeds : DEFAULT_RSS_FEEDS).map(f => ({ ...f, enabled: f.enabled ?? true })),
      minScore: queryMinScore ? Number(queryMinScore) : (data.minScore ?? 50),
      leadNotificationsEnabled: data.leadNotificationsEnabled ?? true,
      minLeadScoreForNotify: data.minLeadScoreForNotify ?? 70,
      excludedCompanies: data.excludedCompanies || [],
      excludedCompaniesTemporary: data.excludedCompaniesTemporary || [],
      emailTemplates: mergedTemplates,
      defaultEmailTemplateIds: resolvedDefaultTemplateIds,
      evaluationPrompts: mergedEvaluationPrompts,
      defaultEvaluationPromptIds: resolvedDefaultEvaluationPromptIds,
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch config' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sales/config
 * Updates config, preserves secret if masked
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const envNaverClientId =
      (process.env.NAVER_CLIENT_ID || process.env.NAVER_CLIENTID || '').trim();
    const envNaverClientSecret =
      (process.env.NAVER_CLIENT_SECRET || process.env.NAVER_CLIENTSECRET || '').trim();
    const envKeywords = parseEnvKeywords(process.env.NAVER_KEYWORDS);

    const {
      naverClientId,
      naverClientSecret,
      naverEnabled,
      naverDaysWindow,
      rssDaysWindow,
      keywords,
      rssFeeds,
      minScore,
      leadNotificationsEnabled,
      minLeadScoreForNotify,
      excludedCompanies,
      excludedCompaniesTemporary,
      emailTemplates,
      defaultEmailTemplateIds,
      evaluationPrompts,
      defaultEvaluationPromptIds,
    } = body;

    // Get existing config
    const existing = stripLegacyScoringFields(
      await redis.get<ConfigData>(RedisKeys.config())
    );

    // Prepare updated config
    const updatedConfig: ConfigData = {
      ...existing,
      naverClientId:
        (naverClientId?.trim() as string) || existing?.naverClientId || envNaverClientId || '',
      naverClientSecret: '',
      naverEnabled: naverEnabled ?? true,
      naverDaysWindow: Number.isFinite(naverDaysWindow) ? Math.max(1, Number(naverDaysWindow)) : (existing?.naverDaysWindow ?? 3),
      rssDaysWindow: Number.isFinite(rssDaysWindow) ? Math.max(1, Number(rssDaysWindow)) : (existing?.rssDaysWindow ?? 7),
      keywords:
        existing?.keywords && existing.keywords.length > 0
          ? existing.keywords
          : (envKeywords.length > 0 ? envKeywords : DEFAULT_KEYWORDS),
      rssFeeds: existing?.rssFeeds?.length ? existing.rssFeeds : DEFAULT_RSS_FEEDS,
      minScore: typeof minScore === 'number' ? minScore : 50,
      leadNotificationsEnabled: typeof leadNotificationsEnabled === 'boolean' ? leadNotificationsEnabled : true,
      minLeadScoreForNotify: typeof minLeadScoreForNotify === 'number' ? minLeadScoreForNotify : 70,
      excludedCompanies: existing?.excludedCompanies || [],
      excludedCompaniesTemporary: existing?.excludedCompaniesTemporary || [],
      emailTemplates: mergeDefaultEmailTemplates(existing?.emailTemplates),
      defaultEmailTemplateIds: resolveDefaultTemplateIds(
        mergeDefaultEmailTemplates(existing?.emailTemplates),
        existing?.defaultEmailTemplateIds
      ),
      evaluationPrompts: mergeDefaultEvaluationPrompts(existing?.evaluationPrompts),
      defaultEvaluationPromptIds: resolveDefaultEvaluationPromptIds(
        mergeDefaultEvaluationPrompts(existing?.evaluationPrompts),
        existing?.defaultEvaluationPromptIds
      ),
      updated_at: new Date().toISOString(),
    };

    // Handle secret: only update if new value provided (not masked/empty)
    if (
      naverClientSecret &&
      naverClientSecret !== MASKED_SECRET &&
      naverClientSecret.trim() !== ''
    ) {
      updatedConfig.naverClientSecret = naverClientSecret.trim();
    } else {
      // Keep existing secret
      updatedConfig.naverClientSecret = existing?.naverClientSecret || envNaverClientSecret || '';
    }

    // Process keywords - accept array OR comma-separated string
    if (keywords) {
      let keywordList: string[] = [];
      if (Array.isArray(keywords)) {
        keywordList = keywords;
      } else if (typeof keywords === 'string') {
        keywordList = keywords.split(',');
      }
      updatedConfig.keywords = keywordList
        .map((k: unknown) => (typeof k === 'string' ? k.trim() : ''))
        .filter((k: string) => k.length > 0)
        .slice(0, MAX_KEYWORDS);
    }

    // Process RSS feeds
    if (Array.isArray(rssFeeds)) {
      const seen = new Set<string>();
      const validFeeds: RSSFeed[] = [];

      for (const feed of rssFeeds) {
        if (!feed || typeof feed !== 'object') continue;

        const category = (feed.category || '').trim();
        const originalUrl = (feed.originalUrl || '').trim();
        const url = (feed.url || '').trim();
        const title = (feed.title || '').trim();

        // Validate required fields
        if (!url || !originalUrl) continue;

        // Validate URL format
        if (
          !url.startsWith('http://') &&
          !url.startsWith('https://')
        ) continue;
        if (
          !originalUrl.startsWith('http://') &&
          !originalUrl.startsWith('https://')
        ) continue;

        // Dedupe by url (case-insensitive)
        const urlLower = url.toLowerCase();
        if (seen.has(urlLower)) continue;
        seen.add(urlLower);

        validFeeds.push({
          category,
          originalUrl,
          url,
          title,
          enabled: feed.enabled ?? true
        });

        if (validFeeds.length >= MAX_RSS_FEEDS) break;
      }

      updatedConfig.rssFeeds = validFeeds;
    }

    if (excludedCompanies !== undefined) {
      const companyList = Array.isArray(excludedCompanies)
        ? excludedCompanies
        : typeof excludedCompanies === 'string'
          ? excludedCompanies.split(',')
          : [];

      const seen = new Set<string>();
      const normalized = companyList
        .map((c: unknown) => (typeof c === 'string' ? c.trim() : ''))
        .filter((c: string) => c.length > 0)
        .filter((c: string) => {
          const key = c.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, MAX_EXCLUDED_COMPANIES);

      updatedConfig.excludedCompanies = normalized;
    }

    if (excludedCompaniesTemporary !== undefined) {
      const now = Date.now();
      const tempList = Array.isArray(excludedCompaniesTemporary)
        ? excludedCompaniesTemporary
        : [];

      const seen = new Set<string>();
      const normalized = tempList
        .map((item: unknown) => {
          const temp = item as { name?: unknown; expiresAt?: unknown };
          return {
            name: typeof temp.name === 'string' ? temp.name.trim() : '',
            expiresAt: Number(temp.expiresAt),
          };
        })
        .filter((item) => item.name.length > 0 && Number.isFinite(item.expiresAt))
        .filter((item) => item.expiresAt > now)
        .filter((item) => {
          const key = item.name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, MAX_TEMP_EXCLUDED_COMPANIES);

      updatedConfig.excludedCompaniesTemporary = normalized;
    }

    if (emailTemplates !== undefined) {
      updatedConfig.emailTemplates = mergeDefaultEmailTemplates(emailTemplates);
    }
    if (evaluationPrompts !== undefined) {
      updatedConfig.evaluationPrompts = mergeDefaultEvaluationPrompts(evaluationPrompts);
    }

    updatedConfig.emailTemplates = mergeDefaultEmailTemplates(updatedConfig.emailTemplates);
    updatedConfig.evaluationPrompts = mergeDefaultEvaluationPrompts(updatedConfig.evaluationPrompts);
    updatedConfig.defaultEmailTemplateIds = resolveDefaultTemplateIds(
      updatedConfig.emailTemplates,
      defaultEmailTemplateIds !== undefined ? defaultEmailTemplateIds : updatedConfig.defaultEmailTemplateIds
    );
    updatedConfig.defaultEvaluationPromptIds = resolveDefaultEvaluationPromptIds(
      updatedConfig.evaluationPrompts,
      defaultEvaluationPromptIds !== undefined
        ? defaultEvaluationPromptIds
        : updatedConfig.defaultEvaluationPromptIds
    );

    // Save to Redis
    await redis.set(RedisKeys.config(), updatedConfig);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: 'Failed to save config' },
      { status: 500 }
    );
  }
}
const DEFAULT_RSS_FEEDS: RSSFeed[] = [
  {
    category: '스타트업',
    originalUrl: 'https://platum.kr',
    url: 'https://platum.kr/feed',
    title: '플래텀 - 스타트업 뉴스',
    enabled: true,
  },
  {
    category: '벤처/투자',
    originalUrl: 'https://www.venturesquare.net',
    url: 'https://www.venturesquare.net/feed',
    title: '벤처스퀘어',
    enabled: true,
  },
  {
    category: 'IT/테크',
    originalUrl: 'https://www.bloter.net',
    url: 'https://www.bloter.net/feed',
    title: '블로터',
    enabled: true,
  },
];
