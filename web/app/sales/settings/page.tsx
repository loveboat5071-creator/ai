'use client';

import { useState, useEffect } from 'react';

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

interface ExcludedLead {
    lead_id: string;
    title: string;
    final_score: number;
    ai_analysis: {
        company_name: string;
    };
}

interface ConfigData {
    naverClientId: string;
    naverClientSecret: string;
    naverEnabled?: boolean;
    naverDaysWindow?: number;
    rssDaysWindow?: number;
    keywords: string[];
    rssFeeds: RSSFeed[];
    minScore: number;
    leadNotificationsEnabled: boolean;
    minLeadScoreForNotify: number;
    excludedCompanies: string[];
    emailTemplates: EmailTemplate[];
    defaultEmailTemplateIds: {
        FOCUS_MEDIA: string;
    };
    evaluationPrompts: EvaluationPrompt[];
    defaultEvaluationPromptIds: {
        FOCUS_MEDIA: string;
    };
}

export default function SalesSettingsPage() {
    const [config, setConfig] = useState<ConfigData>({
        naverClientId: '',
        naverClientSecret: '',
        naverEnabled: true,
        naverDaysWindow: 3,
        rssDaysWindow: 7,
        keywords: [],
        rssFeeds: [],
        minScore: 50,
        leadNotificationsEnabled: true,
        minLeadScoreForNotify: 70,
        excludedCompanies: [],
        emailTemplates: [
            {
                id: 'focus_region_targeting',
                name: '포커스미디어 지역 타게팅',
                mediaType: 'FOCUS_MEDIA',
                instruction: '아파트 단지 엘리베이터 동영상 광고 관점으로 지역/상권 타게팅 중심 제안서를 작성하세요.',
            },
        ],
        defaultEmailTemplateIds: {
            FOCUS_MEDIA: 'focus_region_targeting',
        },
        evaluationPrompts: [
            {
                id: 'focus_default',
                name: '포커스미디어 기본 평가',
                mediaType: 'FOCUS_MEDIA',
                instruction: '아파트 단지 엘리베이터 동영상 광고의 지역 타게팅 중요도를 최우선으로 평가하세요.',
            },
        ],
        defaultEvaluationPromptIds: {
            FOCUS_MEDIA: 'focus_default',
        },
    });

    const [keywordsInput, setKeywordsInput] = useState('');
    const [excludedInput, setExcludedInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [excludedLeads, setExcludedLeads] = useState<ExcludedLead[]>([]);

    // RSS add form
    const [newCategory, setNewCategory] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        loadConfig();
        loadExcludedLeads();
    }, []);

    async function loadExcludedLeads() {
        try {
            const res = await fetch('/api/sales/leads?status=EXCLUDED&source=YOUTUBE_AD&limit=100');
            if (res.ok) {
                const data = await res.json();
                setExcludedLeads(data.leads || []);
            }
        } catch (error) {
            console.error('Failed to load excluded leads:', error);
        }
    }

    async function handleRestoreLead(leadId: string) {
        try {
            const res = await fetch(`/api/sales/leads/${leadId}/state`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'NEW' }),
            });
            if (res.ok) {
                loadExcludedLeads();
                alert('해당 광고가 후보 리스트(신규)로 복구되었습니다.');
            }
        } catch (error) {
            console.error('Restore failed:', error);
        }
    }

    async function loadConfig() {
        try {
            const res = await fetch('/api/sales/config');
            if (res.ok) {
                const data = await res.json();
                setConfig((prev) => ({
                    ...prev,
                    ...data,
                    emailTemplates: Array.isArray(data.emailTemplates) ? data.emailTemplates : prev.emailTemplates,
                    defaultEmailTemplateIds: data.defaultEmailTemplateIds || prev.defaultEmailTemplateIds,
                    evaluationPrompts: Array.isArray(data.evaluationPrompts) ? data.evaluationPrompts : prev.evaluationPrompts,
                    defaultEvaluationPromptIds: data.defaultEvaluationPromptIds || prev.defaultEvaluationPromptIds,
                }));
                setKeywordsInput((data.keywords || []).join(', '));
                setExcludedInput('');
            }
        } catch (error) {
            console.error('Failed to load config:', error);
        } finally {
            setLoading(false);
        }
    }

    const updateField = <K extends keyof ConfigData>(field: K, value: ConfigData[K]) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    function addEmailTemplate() {
        const nextId = `template_${Date.now()}`;
        const nextTemplate: EmailTemplate = {
            id: nextId,
            name: '새 템플릿',
            mediaType: 'FOCUS_MEDIA',
            instruction: '회사명 {{company_name}}, 이슈 {{event_summary}}, 세일즈 포인트 {{sales_angle}}를 활용해 작성하세요.',
        };
        setConfig((prev) => ({
            ...prev,
            emailTemplates: [...prev.emailTemplates, nextTemplate],
        }));
    }

    function updateEmailTemplate<K extends keyof EmailTemplate>(index: number, field: K, value: EmailTemplate[K]) {
        setConfig((prev) => {
            const next = [...prev.emailTemplates];
            next[index] = { ...next[index], [field]: value };
            return { ...prev, emailTemplates: next };
        });
    }

    function removeEmailTemplate(index: number) {
        setConfig((prev) => {
            const next = [...prev.emailTemplates];
            const removed = next[index];
            next.splice(index, 1);
            const nextFocus = next.find((item) => item.mediaType === 'FOCUS_MEDIA')?.id || '';
            return {
                ...prev,
                emailTemplates: next,
                defaultEmailTemplateIds: {
                    FOCUS_MEDIA:
                        removed?.id === prev.defaultEmailTemplateIds.FOCUS_MEDIA
                            ? nextFocus
                            : prev.defaultEmailTemplateIds.FOCUS_MEDIA,
                },
            };
        });
    }

    function addEvaluationPrompt() {
        const nextId = `eval_${Date.now()}`;
        const nextPrompt: EvaluationPrompt = {
            id: nextId,
            name: '새 평가 프롬프트',
            mediaType: 'FOCUS_MEDIA',
            instruction: '평가 기준을 명확하게 작성하세요.',
        };
        setConfig((prev) => ({
            ...prev,
            evaluationPrompts: [...prev.evaluationPrompts, nextPrompt],
        }));
    }

    function updateEvaluationPrompt<K extends keyof EvaluationPrompt>(index: number, field: K, value: EvaluationPrompt[K]) {
        setConfig((prev) => {
            const next = [...prev.evaluationPrompts];
            next[index] = { ...next[index], [field]: value };
            return { ...prev, evaluationPrompts: next };
        });
    }

    function removeEvaluationPrompt(index: number) {
        setConfig((prev) => {
            const next = [...prev.evaluationPrompts];
            const removed = next[index];
            next.splice(index, 1);
            const fallbackFocus = next.find((item) => item.mediaType === 'FOCUS_MEDIA')?.id || '';
            return {
                ...prev,
                evaluationPrompts: next,
                defaultEvaluationPromptIds: {
                    FOCUS_MEDIA:
                        removed?.id === prev.defaultEvaluationPromptIds.FOCUS_MEDIA
                            ? fallbackFocus
                            : prev.defaultEvaluationPromptIds.FOCUS_MEDIA,
                },
            };
        });
    }

    async function handleSave() {
        setSaving(true);
        setMessage('');

        try {
            // Parse keywords from comma-separated input
            const keywords = keywordsInput
                .split(',')
                .map((k) => k.trim())
                .filter((k) => k.length > 0);

            const res = await fetch('/api/sales/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...config,
                    keywords,
                }),
            });

            if (res.ok) {
                setMessage('설정이 저장되었습니다.');
                loadConfig();
            } else {
                setMessage('저장 실패');
            }
        } catch (error) {
            console.error('Save error:', error);
            setMessage('저장 중 오류 발생');
        } finally {
            setSaving(false);
        }
    }

    async function handleTestAndAddFeed() {
        if (!newUrl.trim()) {
            alert('URL을 입력해주세요.');
            return;
        }

        setTesting(true);
        try {
            const res = await fetch('/api/sales/config/test-feed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: newUrl.trim() }),
            });

            const data = await res.json();

            if (data.success) {
                const isDuplicateUrl = config.rssFeeds.some(
                    (f) => f.url.toLowerCase() === data.feedUrl.toLowerCase()
                );
                if (isDuplicateUrl) {
                    alert('이미 등록된 피드입니다.');
                    return;
                }

                const newFeed: RSSFeed = {
                    category: newCategory.trim() || '기타',
                    originalUrl: newUrl.trim(),
                    url: data.feedUrl,
                    title: data.title || '(untitled)',
                    enabled: true,
                };

                setConfig({
                    ...config,
                    rssFeeds: [...config.rssFeeds, newFeed],
                });

                setNewCategory('');
                setNewUrl('');
                alert(`피드 발견: ${data.title || data.feedUrl}`);
            } else {
                alert(`오류: ${data.error}`);
            }
        } catch (error) {
            console.error('Test feed error:', error);
            alert('피드 검증 중 오류 발생');
        } finally {
            setTesting(false);
        }
    }

    function removeFeed(index: number) {
        const updated = [...config.rssFeeds];
        updated.splice(index, 1);
        setConfig({ ...config, rssFeeds: updated });
    }

    function toggleFeed(index: number) {
        const updated = [...config.rssFeeds];
        updated[index] = { ...updated[index], enabled: !(updated[index].enabled ?? true) };
        setConfig({ ...config, rssFeeds: updated });
    }

    function addExcludedCompanies() {
        const names = excludedInput
            .split(',')
            .map((name) => name.trim())
            .filter((name) => name.length > 0);

        if (names.length === 0) return;

        const existing = new Set(config.excludedCompanies.map((c) => c.toLowerCase()));
        const merged = [...config.excludedCompanies];

        for (const name of names) {
            const key = name.toLowerCase();
            if (!existing.has(key)) {
                merged.push(name);
                existing.add(key);
            }
        }

        setConfig({ ...config, excludedCompanies: merged });
        setExcludedInput('');
    }

    function removeExcludedCompany(index: number) {
        const updated = [...config.excludedCompanies];
        updated.splice(index, 1);
        setConfig({ ...config, excludedCompanies: updated });
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-gray-500">로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="max-w-3xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">설정</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        네이버 뉴스, RSS 피드 및 AI 채점 설정
                    </p>
                </div>

                <div className="space-y-6">

                    {/* 1. Email Templates */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">
                                이메일 템플릿
                            </h2>
                            <button
                                onClick={addEmailTemplate}
                                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                            >
                                템플릿 추가
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                            사용 가능한 변수: {'{{company_name}}'}, {'{{event_summary}}'}, {'{{target_audience}}'}, {'{{sales_angle}}'}, {'{{atv_fit_reason}}'}, {'{{homepage_url}}'}
                        </p>

                        <div className="space-y-4">
                            {config.emailTemplates.length === 0 ? (
                                <div className="text-sm text-gray-400">템플릿이 없습니다. 새 템플릿을 추가하세요.</div>
                            ) : (
                                config.emailTemplates.map((template, index) => (
                                    <div key={template.id} className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                                            <div className="sm:col-span-2">
                                                <label className="block text-xs font-medium text-gray-600 mb-1">템플릿 이름</label>
                                                <input
                                                    type="text"
                                                    value={template.name}
                                                    onChange={(e) => updateEmailTemplate(index, 'name', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">매체 타입</label>
                                                <select
                                                    value={template.mediaType}
                                                    onChange={(e) => updateEmailTemplate(index, 'mediaType', e.target.value as 'FOCUS_MEDIA')}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="FOCUS_MEDIA">포커스미디어</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">템플릿 ID</label>
                                                <input
                                                    type="text"
                                                    value={template.id}
                                                    onChange={(e) => updateEmailTemplate(index, 'id', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">작성 지시문</label>
                                        <textarea
                                            value={template.instruction}
                                            onChange={(e) => updateEmailTemplate(index, 'instruction', e.target.value)}
                                            className="w-full h-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <div className="mt-3 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <label className="text-xs text-gray-600 flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="defaultEmailTemplateFocus"
                                                        checked={config.defaultEmailTemplateIds.FOCUS_MEDIA === template.id}
                                                        onChange={() =>
                                                            updateField('defaultEmailTemplateIds', {
                                                                ...config.defaultEmailTemplateIds,
                                                                FOCUS_MEDIA: template.id,
                                                            })
                                                        }
                                                    />
                                                    포커스미디어 기본
                                                </label>
                                            </div>
                                            <button
                                                onClick={() => removeEmailTemplate(index)}
                                                className="text-xs px-2.5 py-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 2. Evaluation Prompts */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">
                                리드 평가 프롬프트
                            </h2>
                            <button
                                onClick={addEvaluationPrompt}
                                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                            >
                                프롬프트 추가
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                            스캔 시 AI 점수 산정에 사용하는 매체별 프롬프트입니다.
                        </p>

                        <div className="space-y-4">
                            {config.evaluationPrompts.length === 0 ? (
                                <div className="text-sm text-gray-400">평가 프롬프트가 없습니다.</div>
                            ) : (
                                config.evaluationPrompts.map((prompt, index) => (
                                    <div key={prompt.id} className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                                            <div className="sm:col-span-2">
                                                <label className="block text-xs font-medium text-gray-600 mb-1">프롬프트 이름</label>
                                                <input
                                                    type="text"
                                                    value={prompt.name}
                                                    onChange={(e) => updateEvaluationPrompt(index, 'name', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">매체 타입</label>
                                                <select
                                                    value={prompt.mediaType}
                                                    onChange={(e) => updateEvaluationPrompt(index, 'mediaType', e.target.value as 'FOCUS_MEDIA')}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="FOCUS_MEDIA">포커스미디어</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">프롬프트 ID</label>
                                                <input
                                                    type="text"
                                                    value={prompt.id}
                                                    onChange={(e) => updateEvaluationPrompt(index, 'id', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">평가 지시문</label>
                                        <textarea
                                            value={prompt.instruction}
                                            onChange={(e) => updateEvaluationPrompt(index, 'instruction', e.target.value)}
                                            className="w-full h-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <div className="mt-3 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <label className="text-xs text-gray-600 flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="defaultEvalPromptFocus"
                                                        checked={config.defaultEvaluationPromptIds.FOCUS_MEDIA === prompt.id}
                                                        onChange={() =>
                                                            updateField('defaultEvaluationPromptIds', {
                                                                ...config.defaultEvaluationPromptIds,
                                                                FOCUS_MEDIA: prompt.id,
                                                            })
                                                        }
                                                    />
                                                    포커스미디어 기본
                                                </label>
                                            </div>
                                            <button
                                                onClick={() => removeEvaluationPrompt(index)}
                                                className="text-xs px-2.5 py-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 3. Notifications Section */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">
                                알림 설정
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">{config.leadNotificationsEnabled ? '활성' : '비활성'}</span>
                                <button
                                    onClick={() => updateField('leadNotificationsEnabled', !config.leadNotificationsEnabled)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${config.leadNotificationsEnabled ? 'bg-blue-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.leadNotificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    알림 발송 기준 점수 (0-100)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={config.minLeadScoreForNotify}
                                    onChange={(e) =>
                                        updateField('minLeadScoreForNotify', Number(e.target.value))
                                    }
                                    className="w-24 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    이 점수 이상의 광고주 후보가 발견되면 텔레그램/슬랙 알림을 보냅니다.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 4. Naver API Section */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">
                                네이버 뉴스 API
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">{config.naverEnabled ? '활성' : '비활성'}</span>
                                <button
                                    onClick={() => updateField('naverEnabled', !config.naverEnabled)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${config.naverEnabled ? 'bg-blue-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.naverEnabled ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Client ID
                                </label>
                                <input
                                    type="text"
                                    value={config.naverClientId}
                                    onChange={(e) =>
                                        updateField('naverClientId', e.target.value)
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="네이버 API Client ID"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Client Secret
                                </label>
                                <input
                                    type="password"
                                    value={config.naverClientSecret}
                                    onChange={(e) =>
                                        updateField('naverClientSecret', e.target.value)
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="변경하지 않으려면 비워두세요"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    네이버 검색 기간 (일)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={config.naverDaysWindow ?? 3}
                                    onChange={(e) =>
                                        updateField('naverDaysWindow', Number(e.target.value))
                                    }
                                    className="w-24 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    검색 키워드 (최대 20개)
                                </label>
                                <textarea
                                    value={keywordsInput}
                                    onChange={(e) => setKeywordsInput(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    placeholder="쉼표로 구분 (예: 광고, 미디어, 마케팅)"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 4. Permanent Exclusions Section */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            영구 제외 기업
                        </h2>
                        <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    value={excludedInput}
                                    onChange={(e) => setExcludedInput(e.target.value)}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="기업명을 쉼표로 구분해서 입력"
                                />
                                <button
                                    onClick={addExcludedCompanies}
                                    className="px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
                                >
                                    추가
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {config.excludedCompanies.length === 0 ? (
                                    <span className="text-sm text-gray-400">등록된 기업 없음</span>
                                ) : (
                                    config.excludedCompanies.map((company, index) => (
                                        <span
                                            key={`${company}-${index}`}
                                            className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full text-xs font-medium"
                                        >
                                            {company}
                                            <button
                                                onClick={() => removeExcludedCompany(index)}
                                                className="text-gray-500 hover:text-red-600"
                                                title="삭제"
                                            >
                                                ✕
                                            </button>
                                        </span>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 5. RSS Feeds Section */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            RSS 피드 관리
                        </h2>

                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <input
                                    type="text"
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="카테고리"
                                />
                                <input
                                    type="text"
                                    value={newUrl}
                                    onChange={(e) => setNewUrl(e.target.value)}
                                    className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="URL"
                                />
                            </div>
                            <button
                                onClick={handleTestAndAddFeed}
                                disabled={testing}
                                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                {testing ? '검증 중...' : '🔍 검증 및 추가'}
                            </button>
                        </div>

                        <div className="space-y-2">
                            {config.rssFeeds.length === 0 ? (
                                <div className="text-center py-6 text-gray-500 text-sm">
                                    등록된 피드가 없습니다.
                                </div>
                            ) : (
                                config.rssFeeds.map((feed, index) => (
                                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">{feed.category}</span>
                                                <span className="text-sm font-medium text-gray-900 truncate">{feed.title}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">{feed.url}</div>
                                        </div>
                                        <div className="flex-shrink-0 flex items-center gap-2">
                                            <button
                                                onClick={() => toggleFeed(index)}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${(feed.enabled ?? true) ? 'bg-blue-600' : 'bg-gray-200'}`}
                                            >
                                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${(feed.enabled ?? true) ? 'translate-x-5' : 'translate-x-1'}`} />
                                            </button>
                                            <button onClick={() => removeFeed(index)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">✕</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 6. Discarded Ads (NEW) */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="text-xl">🗑️</span> 폐기된 광고 리스트 (Shorts Miner)
                        </h2>
                        <p className="text-xs text-gray-500 mb-4">
                            AI 점수가 낮아 자동으로 제외된 유튜브 쇼츠 광고들입니다. 브랜드명과 광고 문구를 확인하고 필요 시 다시 복구할 수 있습니다.
                        </p>

                        <div className="max-h-96 overflow-y-auto border border-gray-100 rounded-lg">
                            {excludedLeads.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 text-sm">폐기된 광고가 없습니다.</div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                                        <tr>
                                            <th className="px-4 py-2">브랜드 / 문구</th>
                                            <th className="px-4 py-2 w-20 text-center">점수</th>
                                            <th className="px-4 py-2 w-20">작업</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {excludedLeads.map((lead) => (
                                            <tr key={lead.lead_id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-gray-900">{lead.ai_analysis.company_name}</div>
                                                    <div className="text-xs text-gray-500 line-clamp-1">{lead.title.includes('|') ? lead.title.split('|')[1] : lead.title}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold text-red-500">{lead.final_score}</td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => handleRestoreLead(lead.lead_id)}
                                                        className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded hover:bg-blue-200 transition-colors"
                                                    >
                                                        복구
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Global Save Button */}
                    <div className="flex items-center gap-4 pt-6 border-t">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition-colors shadow-lg"
                        >
                            {saving ? '저장 중...' : '모든 설정 저장'}
                        </button>

                        {message && (
                            <span className={`text-sm font-medium ${message.includes('성공') ? 'text-green-600' : 'text-red-600'}`}>
                                {message}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
