// lib/ai-client.ts
// Ported from Streamlit ai/recommender.py

import {
    getExpansionAndUnderstandingPrompt,
    getSegmentFilteringPrompt,
    getSegmentRecommendationPrompt,
} from './prompts';

export interface Segment {
    대분류: string;
    중분류: string;
    소분류: string | null;
    name: string;
    description: string;
    recommended_advertisers?: string;
    full_path?: string;
    reason?: string;
    confidence_score?: number;
    key_factors?: string[];
}

interface AIResponse {
    text: string;
}

// --- AI Client Base ---
async function callGemini(prompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
            }),
        }
    );

    if (response.status === 429) {
        throw new Error('429 Resource exhausted');
    }

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callDeepSeek(prompt: string): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

// --- AI Client with Fallback ---
async function generateWithRetry(prompt: string, maxRetries: number = 3): Promise<string> {
    let retries = 0;
    let lastError: Error | null = null;

    // Try Gemini first
    while (retries < maxRetries) {
        try {
            return await callGemini(prompt);
        } catch (e: any) {
            lastError = e;
            if (e.message.includes('429') && retries < maxRetries - 1) {
                retries++;
                const waitTime = Math.pow(2, retries) * 1000;
                console.log(`Gemini 429 error, waiting ${waitTime}ms before retry...`);
                await new Promise((r) => setTimeout(r, waitTime));
            } else {
                break;
            }
        }
    }

    // Fallback to DeepSeek
    console.log('Falling back to DeepSeek...');
    try {
        return await callDeepSeek(prompt);
    } catch (e: any) {
        throw new Error(`All AI providers failed. Last error: ${lastError?.message || e.message}`);
    }
}

// --- URL Scraping ---
async function fetchUrlContent(url: string): Promise<string> {
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) return '';

        const html = await response.text();

        // Extract meta description or body text
        const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
        if (metaMatch?.[1]) return metaMatch[1].substring(0, 1500);

        // Simple text extraction
        const bodyText = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return bodyText.substring(0, 1500);
    } catch {
        return '';
    }
}

// --- JSON Parsing Helper ---
function parseJsonResponse(text: string): any {
    const cleaned = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
    return JSON.parse(cleaned);
}

// --- Main Recommender ---
export async function recommendSegments(
    productName: string,
    websiteUrl: string,
    segments: Segment[],
    numRecommendations: number = 5
): Promise<{
    segments: Segment[];
    understanding: string;
    keywords: string[];
}> {
    let productUnderstanding = '';
    let expandedKeywords: string[] = [];

    // 0. Scrape URL if provided
    let scrapedText = '';
    if (websiteUrl) {
        scrapedText = await fetchUrlContent(websiteUrl);
    }

    // 1. Get product understanding and expanded keywords
    try {
        const prompt = getExpansionAndUnderstandingPrompt(productName, websiteUrl, scrapedText);
        const response = await generateWithRetry(prompt);
        const parsed = parseJsonResponse(response);
        productUnderstanding = parsed.product_understanding || '';
        expandedKeywords = parsed.expanded_keywords || [];
    } catch (e) {
        console.error('Step 0 (expansion) failed:', e);
        productUnderstanding = `제품명: ${productName} (AI 자동 분석 실패)`;
    }

    if (productName && !expandedKeywords.includes(productName)) {
        expandedKeywords.unshift(productName);
    }

    // Build segment info with full_path
    const allSegmentsInfo: Segment[] = segments.map((seg) => {
        const cat3 = seg.소분류;
        const fullPath =
            cat3 && cat3 !== 'null'
                ? `${seg.대분류} > ${seg.중분류} > ${cat3} > ${seg.name}`
                : `${seg.대분류} > ${seg.중분류} > ${seg.name}`;

        return {
            ...seg,
            full_path: fullPath,
        };
    });

    // 2. Get priority segments (A-class) by keyword matching
    const { prioritySegments, remainingSegments } = getPrioritySegments(
        expandedKeywords,
        allSegmentsInfo
    );

    // 3. Filter B-class candidates with AI
    let bClassCandidates: Segment[] = [];
    const numBClassNeeded = Math.max(0, numRecommendations - prioritySegments.length);

    if (remainingSegments.length > 0 && (numBClassNeeded > 0 || prioritySegments.length === 0)) {
        try {
            const segmentsWithDesc = remainingSegments
                .map((s) => `- ${s.name} (설명: ${s.description || 'N/A'})`)
                .join('\n');

            const prompt = getSegmentFilteringPrompt(productUnderstanding, segmentsWithDesc, 20);
            const response = await generateWithRetry(prompt);
            const parsed = parseJsonResponse(response);
            const candidateNames: string[] = parsed.candidate_segments || [];

            bClassCandidates = getSegmentsByNames(candidateNames, remainingSegments);
        } catch (e) {
            console.error('Step 1 (filtering) failed:', e);
        }
    }

    // 4. Final ranking with AI
    const finalCandidateList = [...prioritySegments, ...bClassCandidates];
    let allRecommendations: Segment[] = [];

    if (finalCandidateList.length > 0) {
        try {
            const segmentsWithDesc = finalCandidateList
                .map((s) => {
                    let str = `- ${s.name} (설명: ${s.description || 'N/A'}`;
                    if (s.recommended_advertisers) {
                        str += `, 추천 광고주: ${s.recommended_advertisers.replace(/\n/g, ', ')}`;
                    }
                    str += ')';
                    return str;
                })
                .join('\n');

            const prompt = getSegmentRecommendationPrompt(
                productUnderstanding,
                segmentsWithDesc,
                Math.max(numRecommendations, 5)
            );
            const response = await generateWithRetry(prompt);
            const parsed = parseJsonResponse(response);

            if (parsed.recommended_segments) {
                allRecommendations = enrichAndSortSegments(
                    parsed.recommended_segments,
                    finalCandidateList
                );
            }
        } catch (e) {
            console.error('Step 2 (ranking) failed:', e);
        }
    }

    // 5. Deduplicate and pad with fallback
    const finalRecommendations: Segment[] = [];
    const seenNames = new Set<string>();

    for (const seg of allRecommendations) {
        if (!seenNames.has(seg.name)) {
            finalRecommendations.push(seg);
            seenNames.add(seg.name);
        }
    }

    // Fallback padding
    const numToPad = numRecommendations - finalRecommendations.length;
    if (numToPad > 0) {
        const existingNames = new Set(finalRecommendations.map((s) => s.name));
        const fallbackSegments = allSegmentsInfo.filter((s) => !existingNames.has(s.name));

        for (let i = 0; i < Math.min(numToPad, fallbackSegments.length); i++) {
            finalRecommendations.push({
                ...fallbackSegments[i],
                reason: '제품과 관련성이 높은 기본 세그먼트입니다.',
                confidence_score: 60,
                key_factors: ['기본 추천'],
            });
        }
    }

    return {
        segments: finalRecommendations.slice(0, numRecommendations),
        understanding: productUnderstanding,
        keywords: expandedKeywords,
    };
}

// --- Helper Functions ---
function getPrioritySegments(
    expandedKeywords: string[],
    allSegmentsInfo: Segment[]
): { prioritySegments: Segment[]; remainingSegments: Segment[] } {
    if (!expandedKeywords.length) {
        return { prioritySegments: [], remainingSegments: allSegmentsInfo };
    }

    const prioritySegments: Segment[] = [];
    const remainingSegments: Segment[] = [];
    const priorityNames = new Set<string>();
    const lowerKeywords = expandedKeywords
        .filter((kw) => kw && kw.length > 1)
        .map((kw) => kw.toLowerCase());

    if (!lowerKeywords.length) {
        return { prioritySegments: [], remainingSegments: allSegmentsInfo };
    }

    for (const segment of allSegmentsInfo) {
        let found = false;
        const searchText = `${segment.name} ${segment.description} ${segment.recommended_advertisers || ''}`.toLowerCase();

        for (const keyword of lowerKeywords) {
            if (searchText.includes(keyword)) {
                if (!priorityNames.has(segment.name)) {
                    prioritySegments.push(segment);
                    priorityNames.add(segment.name);
                }
                found = true;
                break;
            }
        }

        if (!found) {
            remainingSegments.push(segment);
        }
    }

    return { prioritySegments, remainingSegments };
}

function getSegmentsByNames(names: string[], availableSegments: Segment[]): Segment[] {
    const nameMap = new Map(availableSegments.map((s) => [s.name, s]));
    return names.filter((name) => nameMap.has(name)).map((name) => nameMap.get(name)!);
}

function enrichAndSortSegments(
    segmentsFromAI: Array<{
        name: string;
        reason?: string;
        confidence_score?: number;
        key_factors?: string[];
    }>,
    candidateSegments: Segment[]
): Segment[] {
    const enrichedInfoMap = new Map(
        segmentsFromAI.map((s) => [
            s.name,
            {
                reason: s.reason || '추천 이유를 생성하지 못했습니다.',
                confidence_score: s.confidence_score || 50,
                key_factors: s.key_factors || [],
            },
        ])
    );

    const recommendations: Segment[] = [];
    for (const aiSeg of segmentsFromAI) {
        const segData = candidateSegments.find((s) => s.name === aiSeg.name);
        if (segData) {
            const enriched = enrichedInfoMap.get(aiSeg.name);
            recommendations.push({
                ...segData,
                reason: enriched?.reason,
                confidence_score: enriched?.confidence_score,
                key_factors: enriched?.key_factors,
            });
        }
    }

    recommendations.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
    return recommendations;
}
