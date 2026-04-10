'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// Types
interface AIAnalysis {
  company_name: string;
  event_summary: string;
  target_audience: string;
  atv_fit_reason: string;
  sales_angle: string;
  ai_score: number;
  contact_email?: string | null;
  contact_phone?: string | null;
  pr_agency?: string | null;
  homepage_url?: string | null;
}

interface HomepageEnrichment {
  emails: string[];
  phones: string[];
  description: string | null;
  title: string | null;
  scraped_at: number;
  success: boolean;
  error?: string;
  pages_crawled?: number;
  crawled_urls?: string[];
  contact_pages?: string[];
  company_overview?: string | null;
  key_services?: string[];
  key_messages?: string[];
  evidence_snippets?: string[];
  contact_confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
  primary_email?: string | null;
  primary_phone?: string | null;
}

interface LeadState {
  lead_id: string;
  status: string;
  tags: string[];
  next_action?: string;
  assigned_to?: string;
  status_changed_at: number;
  last_contacted_at?: number;
  analyzed_at?: number;
}

interface OutreachLog {
  id: string;
  lead_id: string;
  type: 'email' | 'phone';
  subject?: string;
  status: 'sent' | 'replied' | 'bounced';
  sent_at: number;
}

const LeadStatus = {
  NEW: 'NEW',
  EXCLUDED: 'EXCLUDED',
  WON: 'WON',
  LOST: 'LOST',
};

interface Lead {
  lead_id: string;
  media_type?: 'FOCUS_MEDIA';
  title: string;
  link: string;
  contentSnippet: string;
  pubDate: string;
  source: string;
  keyword?: string;
  ai_analysis: AIAnalysis;
  enrichment?: HomepageEnrichment;
  final_score: number;
  created_at: number;
  updated_at: number;
  state: LeadState;
  notes_count: number;
  outreach_log?: OutreachLog[];
}

interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  author?: string;
  created_at: number;
}

interface SalesConfig {
  naverClientId: string;
  naverClientSecret: string;
  naverEnabled?: boolean;
  keywords: string[];
  rssFeeds: Array<{
    category: string;
    originalUrl: string;
    url: string;
    title: string;
    enabled?: boolean;
  }>;
  minScore: number;
  leadNotificationsEnabled: boolean;
  minLeadScoreForNotify: number;
  excludedCompanies?: string[];
  excludedCompaniesTemporary?: Array<{ name: string; expiresAt: number }>;
  emailTemplates?: Array<{
    id: string;
    name: string;
    mediaType: 'FOCUS_MEDIA';
    instruction: string;
  }>;
  defaultEmailTemplateIds?: {
    FOCUS_MEDIA?: string;
  };
}

type ScanTargetType = 'ALL' | 'NAVER' | 'RSS';
type LeadPathType = 'ALL' | 'FOCUS_MEDIA';

interface ScanRssFeedOption {
  category: string;
  title: string;
  url: string;
  originalUrl: string;
  enabled?: boolean;
}

const STATUSES = ['ALL', 'NEW', 'CONTACTED', 'IN_PROGRESS', 'ON_HOLD', 'WON', 'LOST', 'EXCLUDED', 'PERMANENT_EXCLUDED'];
const STATUS_LABELS: Record<string, string> = {
  ALL: '전체',
  NEW: '신규',
  CONTACTED: '연락완료',
  IN_PROGRESS: '진행중',
  ON_HOLD: '보류',
  WON: '성공',
  LOST: '실패',
  EXCLUDED: '제외',
  PERMANENT_EXCLUDED: '영구제외',
};

export default function SalesDashboardPage() {
  const [currentStatus, setCurrentStatus] = useState('NEW');
  const [sortBy, setSortBy] = useState('latest');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState('');

  const [scanning, setScanning] = useState(false);
  const [autoScanning, setAutoScanning] = useState(false);
  const autoScanRef = useRef(false);
  const [smartScanning, setSmartScanning] = useState(false);
  const smartScanRef = useRef(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [queueLength, setQueueLength] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [excludedCompanies, setExcludedCompanies] = useState<string[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailGenerating, setEmailGenerating] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<Array<{ id: string; name: string; mediaType: 'FOCUS_MEDIA'; instruction: string }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Helper for KST time formatting
  function formatKST(dateStr?: string | number) {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      const parts = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Seoul',
      }).formatToParts(date);

      const p: Record<string, string> = {};
      parts.forEach(part => p[part.type] = part.value);
      return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
    } catch {
      return '-';
    }
  }

  function handleCopyEmail(email: string) {
    navigator.clipboard.writeText(email);
    alert('이메일 주소가 복사되었습니다.');
  }

  function handleCopyPhone(phone: string) {
    navigator.clipboard.writeText(phone);
    alert('연락처가 복사되었습니다.');
  }

  function formatRelativeFromNow(timestamp?: number) {
    if (!timestamp) return null;
    const diffMs = Date.now() - timestamp;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays <= 0) return '오늘';
    if (diffDays === 1) return '1일 전';
    return `${diffDays}일 전`;
  }

  function normalizeExternalUrl(url?: string | null) {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+([/?#].*)?$/.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return null;
  }

  function normalizeLeadMediaType(_mediaType?: string | null): 'FOCUS_MEDIA' {
    return 'FOCUS_MEDIA';
  }

  function mediaTypeLabel(_mediaType?: string | null): string {
    return '포커스미디어';
  }

  const [scanLimit] = useState(30);
  const [minScore, setMinScore] = useState(50);
  const [scanTarget, setScanTarget] = useState<ScanTargetType>('ALL');
  const [scanRssFeeds, setScanRssFeeds] = useState<ScanRssFeedOption[]>([]);
  const [selectedRssFeedUrl, setSelectedRssFeedUrl] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<LeadPathType>('ALL');

  useEffect(() => {
    loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
    if (currentStatus === 'PERMANENT_EXCLUDED') {
      setSelectedLeads(new Set());
    }
  }, [currentStatus, sortBy, sourceFilter, mediaTypeFilter]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/sales/config');
        if (res.ok) {
          const data = (await res.json()) as SalesConfig;
          setExcludedCompanies(data.excludedCompanies || []);
          const rssFeeds = (data.rssFeeds || []).filter((feed) => feed.enabled !== false);
          setScanRssFeeds(rssFeeds);
          setSelectedRssFeedUrl('ALL');
          const templates = (data.emailTemplates || []).filter((item) => item.mediaType === 'FOCUS_MEDIA');
          setEmailTemplates(templates);
          const defaultFocus =
            data.defaultEmailTemplateIds?.FOCUS_MEDIA ||
            templates.find((item) => item.mediaType === 'FOCUS_MEDIA')?.id ||
            templates[0]?.id ||
            '';
          setSelectedTemplateId(defaultFocus);
        }
      } catch (error) {
        console.error('Failed to load excluded companies:', error);
      }
    })();
  }, []);

  useEffect(() => {
    loadQueueLength();
    const interval = setInterval(() => {
      loadQueueLength();
    }, 10000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  async function loadQueueLength() {
    try {
      const res = await fetch('/api/sales/scan/queue');
      if (res.ok) {
        const data = await res.json();
        if (typeof data.queueLength === 'number') {
          setQueueLength(data.queueLength);
        }
      }
    } catch (error) {
      console.error('Failed to load queue length:', error);
    }
  }

  useEffect(() => {
    if (selectedLead) {
      loadNotes(selectedLead.lead_id);
      setEmailDraft('');
    }
  }, [selectedLead]);

  useEffect(() => {
    const leadMediaType = normalizeLeadMediaType(selectedLead?.media_type);
    const templatesForLead = emailTemplates.filter((template) => template.mediaType === leadMediaType);
    if (templatesForLead.length === 0) return;

    const exists = templatesForLead.some((template) => template.id === selectedTemplateId);
    if (!exists) {
      setSelectedTemplateId(templatesForLead[0].id);
    }
  }, [selectedLead, emailTemplates, selectedTemplateId]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  async function loadLeads(
    status: string,
    sort: string = 'latest',
    source: string = 'ALL',
    mediaType: LeadPathType = 'ALL'
  ) {
    setLoading(true);
    try {
      if (status === 'PERMANENT_EXCLUDED') {
        setLeads([]);
        return;
      }

      const sourceQuery = source !== 'ALL' ? `&source=${source}` : '';
      const mediaTypeQuery = mediaType !== 'ALL' ? `&mediaType=${mediaType}` : '';
      const res = await fetch(`/api/sales/leads?status=${status}&sortBy=${sort}${sourceQuery}${mediaTypeQuery}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        if (data.counts) {
          setStatusCounts(data.counts);
        }
      }
    } catch (error) {
      console.error('Failed to load leads:', error);
    } finally {
      setLoading(false);
    }
  }

  const SOURCES = [
    { value: 'ALL', label: '모든 소스' },
    { value: 'YOUTUBE_AD', label: 'YouTube 광고' },
    { value: 'RSS', label: 'RSS 피드' },
    { value: 'NAVER', label: '네이버 뉴스' }
  ];

  async function handleScan() {
    if (scanTarget === 'RSS' && scanRssFeeds.length === 0) {
      alert('활성화된 RSS 피드가 없습니다. 설정에서 RSS 피드를 먼저 등록/활성화하세요.');
      return;
    }

    setScanning(true);
    try {
      const params = new URLSearchParams({
        limit: String(scanLimit),
        minScore: String(minScore),
        scanTarget,
      });
      if (scanTarget === 'RSS' && selectedRssFeedUrl !== 'ALL') {
        params.set('rssFeedUrl', selectedRssFeedUrl);
      }
      const res = await fetch(
        `/api/sales/scan?${params.toString()}`,
        { method: 'POST' }
      );

      if (res.ok) {
        const data = await res.json();
        const selectedFeed = scanRssFeeds.find(
          (feed) => feed.url === selectedRssFeedUrl || feed.originalUrl === selectedRssFeedUrl
        );
        const targetLabel =
          scanTarget === 'ALL'
            ? '전체 소스'
            : scanTarget === 'NAVER'
              ? '네이버 뉴스'
              : selectedRssFeedUrl === 'ALL'
                ? 'RSS 전체'
                : `RSS: ${selectedFeed?.title || selectedFeed?.category || '선택 피드'}`;
        alert(
          `개별 스캔 완료 (${targetLabel})!\n분석: ${data.stats?.analyzed || 0}개\n필터 통과: ${data.stats?.passed_filter || 0
          }개`
        );
        loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
        setCooldown(30);
      } else {
        alert('스캔 실패');
      }
    } catch (error) {
      console.error('Scan error:', error);
      alert('스캔 중 오류 발생');
    } finally {
      setScanning(false);
    }
  }

  async function handleIncrementalScan(isAuto = false) {
    setScanning(true);
    setScanStatus('스캔 중...');
    try {
      const res = await fetch(`/api/sales/scan/cron?minScore=${minScore}&token=wsmedia-sales`);
      if (res.ok) {
        const data = await res.json();
        const msg = `반영 완료: ${data.source || data.feed || '-'}`;
        setScanStatus(msg);
        if (typeof data.queueLength === 'number') {
          setQueueLength(data.queueLength);
        }

        if (!isAuto) {
          alert(
            `증분 스캔 완료!\n소스: ${data.source || data.feed || '-'}\n새 광고주 후보: ${data.newLeads || 0}개\n다음: ${data.nextSourceName || (data.nextSourceIndex + 1 + '번째')}`
          );
        }
        loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
        return data;
      } else {
        if (!isAuto) alert('증분 스캔 실패');
        return null;
      }
    } catch (error) {
      console.error('Incremental scan error:', error);
      if (!isAuto) alert('증분 스캔 중 오류 발생');
      return null;
    } finally {
      setScanning(false);
    }
  }

  async function handleAutoFullScan() {
    if (autoScanning) {
      setAutoScanning(false);
      autoScanRef.current = false;
      setScanStatus('스캔 중단됨');
      return;
    }

    setAutoScanning(true);
    autoScanRef.current = true;
    setScanStatus('전체 스캔 시작...');

    try {
      let currentIdx = -1;
      let total = 99; // Initial dummy
      let count = 0;

      while (count < total && autoScanRef.current) {
        setScanStatus(`스캔 중... (${count + 1}번째 소스)`);
        const result = await handleIncrementalScan(true);

        if (!result || !autoScanRef.current) {
          if (!autoScanRef.current) setScanStatus('스캔 중단됨');
          else setScanStatus('스캔 실패로 중단됨');
          break;
        }

        total = result.totalSources || 1;
        currentIdx = result.nextSourceIndex || 0;

        if (currentIdx === 0) {
          setScanStatus('전체 스캔 완료! ✅');
          break;
        }

        count++;
        // Wait 15 seconds with countdown
        for (let i = 15; i > 0; i--) {
          if (!autoScanRef.current) break;
          setScanStatus(`대기 중 (${i}초)... 다음: ${result.nextSourceName || (result.nextSourceIndex + 1 + '번째')}`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    } catch {
      setScanStatus('오류 발생으로 중단됨');
    } finally {
      setAutoScanning(false);
      autoScanRef.current = false;
    }
  }

  async function handleSmartQueueScan() {
    if (smartScanning) {
      setSmartScanning(false);
      smartScanRef.current = false;
      setScanStatus('큐 처리 중단됨');
      return;
    }

    setSmartScanning(true);
    smartScanRef.current = true;
    const initialQueue = queueLength ?? 0;
    const formatProgress = (total: number, processed: number, found: number, discarded: number, remaining: number) => {
      const base = total > 0 ? Math.min(100, Math.round(((total - remaining) / total) * 100)) : 0;
      return `${total}개 중 ${processed}개 처리완료. ${found}개 발견, ${discarded}개 폐기. ${remaining}개 남음. 진도율 ${base}%`;
    };
    setScanStatus(formatProgress(initialQueue, 0, 0, 0, initialQueue));

    const MAX_ROUNDS = 100; // Max 100 rounds (safety limit)
    let round = 1;
    let totalProcessed = 0;
    let totalAnalyzed = 0;
    let totalFound = 0;

    try {
      while (round <= MAX_ROUNDS && smartScanRef.current) {
        const res = await fetch(`/api/sales/scan/cron?minScore=${minScore}&mode=drain&token=wsmedia-sales`);

        if (!res.ok) {
          setScanStatus('큐 처리 실패로 중단됨');
          break;
        }

        const data = await res.json();
        const processed = data.processed || 0;
        const analyzed = data.analyzed || 0;
        totalProcessed += processed;
        totalAnalyzed += analyzed;
        totalFound += processed;
        if (typeof data.queueLength === 'number') {
          setQueueLength(data.queueLength);
        }

        // Update status with cumulative progress
        const remaining = data.queueLength || 0;
        const total = initialQueue;
        const discarded = Math.max(0, totalAnalyzed - totalFound);
        setScanStatus(formatProgress(total, totalProcessed, totalFound, discarded, remaining));
        if (processed > 0) {
          loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
        }

        // Stop only when queue is empty
        if (data.queueLength === 0) {
          setScanStatus(`✅ 큐 처리 완료! (총 ${totalProcessed}개 처리)`);
          setQueueLength(0);
          loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
          break;
        }

        round++;

        // Wait 2 seconds before next round (prevent rate limiting)
        if (smartScanRef.current && round <= MAX_ROUNDS) {
          for (let i = 2; i > 0; i--) {
            if (!smartScanRef.current) break;
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }

      if (round > MAX_ROUNDS) {
        const remaining = queueLength ?? 0;
        const discarded = Math.max(0, totalAnalyzed - totalFound);
        setScanStatus(`⚠️ 최대 라운드 도달. ${formatProgress(initialQueue, totalProcessed, totalFound, discarded, remaining)}`);
      }

      // Reload leads after completion
      loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
    } catch (err) {
      console.error('Smart queue scan error:', err);
      setScanStatus('오류 발생으로 중단됨');
    } finally {
      setSmartScanning(false);
      smartScanRef.current = false;
    }
  }

  async function handleDeleteLead(leadId: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/sales/leads/${leadId}`, { method: 'DELETE' });
      if (res.ok) {
        setLeads(leads.filter(l => l.lead_id !== leadId));
        if (selectedLeads.has(leadId)) {
          const next = new Set(selectedLeads);
          next.delete(leadId);
          setSelectedLeads(next);
        }
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  }

  async function handleBulkDelete() {
    if (selectedLeads.size === 0) return;
    if (!confirm(`선택한 ${selectedLeads.size}개의 광고주 후보를 정말 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch('/api/sales/leads/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: Array.from(selectedLeads) }),
      });
      if (res.ok) {
        setLeads(leads.filter(l => !selectedLeads.has(l.lead_id)));
        setSelectedLeads(new Set());
      }
    } catch (error) {
      console.error('Bulk delete failed:', error);
    }
  }

  function getSelectedLeadsInfo() {
    return leads.filter((lead) => selectedLeads.has(lead.lead_id));
  }

  function getSelectedCompanyNames() {
    const selected = getSelectedLeadsInfo();
    const seen = new Set<string>();
    const names: string[] = [];

    for (const lead of selected) {
      const name = lead.ai_analysis.company_name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }

    return names;
  }

  async function updateExcludedConfig(options: {
    permanent?: string[];
    replacePermanent?: string[];
    temporary?: Array<{ name: string; expiresAt: number }>;
  }) {
    const configRes = await fetch('/api/sales/config');
    if (!configRes.ok) {
      throw new Error('Failed to load config');
    }

    const config = (await configRes.json()) as SalesConfig;
    let permanent = config.excludedCompanies || [];
    const temporary = config.excludedCompaniesTemporary || [];

    if (options.replacePermanent) {
      permanent = options.replacePermanent;
    } else if (options.permanent) {
      const seen = new Set(permanent.map((name) => name.toLowerCase()));
      for (const name of options.permanent) {
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          permanent.push(name);
          seen.add(key);
        }
      }
    }

    if (options.temporary) {
      const now = Date.now();
      const merged = new Map<string, { name: string; expiresAt: number }>();
      for (const item of temporary) {
        if (!item || item.expiresAt <= now) continue;
        merged.set(item.name.toLowerCase(), item);
      }
      for (const item of options.temporary) {
        if (!item.name || item.expiresAt <= now) continue;
        const key = item.name.toLowerCase();
        const existing = merged.get(key);
        if (!existing || existing.expiresAt < item.expiresAt) {
          merged.set(key, item);
        }
      }
      const updated = Array.from(merged.values());
      config.excludedCompaniesTemporary = updated;
    }

    const saveRes = await fetch('/api/sales/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        naverClientId: config.naverClientId,
        naverClientSecret: config.naverClientSecret,
        naverEnabled: config.naverEnabled,
        keywords: config.keywords,
        rssFeeds: config.rssFeeds,
        minScore: config.minScore,
        leadNotificationsEnabled: config.leadNotificationsEnabled,
        minLeadScoreForNotify: config.minLeadScoreForNotify,
        excludedCompanies: permanent,
        excludedCompaniesTemporary: config.excludedCompaniesTemporary,
      }),
    });

    if (!saveRes.ok) {
      throw new Error('Failed to save config');
    }

    setExcludedCompanies(permanent);
  }

  async function bulkUpdateStatus(status: string) {
    const leadIds = Array.from(selectedLeads);
    if (leadIds.length === 0) return;

    const res = await fetch('/api/sales/leads/bulk-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds, status }),
    });

    if (!res.ok) {
      throw new Error('Failed to update lead status');
    }
  }

  async function handleBulkRestoreExcluded() {
    if (selectedLeads.size === 0) return;
    if (!confirm(`선택한 ${selectedLeads.size}개의 광고주 후보를 제외 해제하시겠습니까?`)) return;

    try {
      await bulkUpdateStatus('NEW');
      setSelectedLeads(new Set());
      loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
    } catch (error) {
      console.error('Bulk restore failed:', error);
      alert('제외 해제 처리 중 오류가 발생했습니다.');
    }
  }

  async function handleBulkTemporaryExclude(days: number) {
    if (selectedLeads.size === 0) return;
    if (!confirm(`선택한 ${selectedLeads.size}개의 광고주 후보를 ${days}일 제외하시겠습니까?`)) return;

    const companies = getSelectedCompanyNames();
    if (companies.length === 0) {
      alert('기업명이 없는 광고주 후보는 제외 목록에 추가할 수 없습니다.');
      return;
    }

    try {
      const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
      await updateExcludedConfig({
        temporary: companies.map((name) => ({ name, expiresAt })),
      });
      await bulkUpdateStatus('EXCLUDED');
      setSelectedLeads(new Set());
      loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
    } catch (error) {
      console.error('Bulk temporary exclude failed:', error);
      alert('일시 제외 처리 중 오류가 발생했습니다.');
    }
  }

  async function handleBulkPermanentExclude() {
    if (selectedLeads.size === 0) return;
    if (!confirm(`선택한 ${selectedLeads.size}개의 광고주 후보를 영구 제외하시겠습니까?`)) return;

    const companies = getSelectedCompanyNames();
    if (companies.length === 0) {
      alert('기업명이 없는 광고주 후보는 제외 목록에 추가할 수 없습니다.');
      return;
    }

    try {
      await updateExcludedConfig({ permanent: companies });
      await bulkUpdateStatus('EXCLUDED');
      setSelectedLeads(new Set());
      loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
    } catch (error) {
      console.error('Bulk permanent exclude failed:', error);
      alert('영구 제외 처리 중 오류가 발생했습니다.');
    }
  }

  async function handleBulkPermanentRestore() {
    if (selectedLeads.size === 0) return;
    if (!confirm(`선택한 ${selectedLeads.size}개의 광고주 후보를 영구 제외 해제하시겠습니까?`)) return;

    const companies = getSelectedCompanyNames();
    if (companies.length === 0) {
      alert('기업명이 없는 광고주 후보는 제외 해제할 수 없습니다.');
      return;
    }

    try {
      const remaining = excludedCompanies.filter(
        (company) => !companies.some((name) => name.toLowerCase() === company.toLowerCase())
      );
      await updateExcludedConfig({ replacePermanent: remaining });
      setSelectedLeads(new Set());
      loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
    } catch (error) {
      console.error('Bulk permanent restore failed:', error);
      alert('영구 제외 해제 처리 중 오류가 발생했습니다.');
    }
  }

  function toggleSelectAll() {
    if (selectedLeads.size === leads.length && leads.length > 0) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map(l => l.lead_id)));
    }
  }

  function toggleSelectLead(id: string) {
    const next = new Set(selectedLeads);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeads(next);
  }

  async function loadNotes(leadId: string) {
    try {
      const res = await fetch(`/api/sales/leads/${leadId}/notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  }

  async function handleAddNote() {
    if (!selectedLead || !newNote.trim()) return;

    try {
      const res = await fetch(`/api/sales/leads/${selectedLead.lead_id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote }),
      });

      if (res.ok) {
        setNewNote('');
        loadNotes(selectedLead.lead_id);
        loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
      }
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  }

  async function handleEnrichHomepage() {
    if (!selectedLead) return;

    if (!selectedLead.ai_analysis.homepage_url) {
      alert('홈페이지 URL이 없습니다.');
      return;
    }

    setEnriching(true);
    try {
      const res = await fetch(`/api/sales/leads/${selectedLead.lead_id}/enrich`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        // Update selected lead with enrichment data
        setSelectedLead({
          ...selectedLead,
          enrichment: data.enrichment,
        });
        // Reload leads to get updated data
        loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
        alert(`홈페이지 크롤링 완료!\n이메일 ${data.enrichment.emails.length}개, 전화번호 ${data.enrichment.phones.length}개 발견`);
      } else {
        const error = await res.json();
        alert(`크롤링 실패: ${error.details || error.error}`);
      }
    } catch (error) {
      console.error('Failed to enrich homepage:', error);
      alert('홈페이지 크롤링 중 오류가 발생했습니다.');
    } finally {
      setEnriching(false);
    }
  }

  async function logOutreach(leadId: string, subject?: string) {
    try {
      const res = await fetch(`/api/sales/leads/${leadId}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          status: 'sent',
          subject: subject || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (selectedLead?.lead_id === leadId) {
          setSelectedLead({
            ...selectedLead,
            state: data.state,
            outreach_log: [data.log, ...(selectedLead.outreach_log || [])].slice(0, 3),
          });
        }
      }
      loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
    } catch (error) {
      console.error('Failed to log outreach:', error);
    }
  }

  async function handleGenerateEmailDraft() {
    if (!selectedLead) return;

    setEmailGenerating(true);
    try {
      const res = await fetch(`/api/sales/leads/${selectedLead.lead_id}/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplateId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate email draft');
      }

      const data = await res.json();
      setEmailDraft(formatDraftForEditor(data.draft || ''));
    } catch (error) {
      console.error('Failed to generate email draft:', error);
      alert('메일 초안 생성 중 오류가 발생했습니다.');
    } finally {
      setEmailGenerating(false);
    }
  }

  function buildChatGptPrompt(lead: Lead) {
    const leadMediaType = normalizeLeadMediaType(lead.media_type);
    const availableTemplates = emailTemplates.filter((template) => template.mediaType === leadMediaType);
    const selectedTemplate =
      availableTemplates.find((template) => template.id === selectedTemplateId) || availableTemplates[0];
    const templateName = selectedTemplate?.name || '포커스미디어 기본';
    const templateInstruction =
      selectedTemplate?.instruction ||
      '지역/상권 타게팅 중심으로 엘리베이터TV 제안 메일을 작성하세요.';
    const productLabel = '포커스미디어 엘리베이터TV';
    const organizationLabel = 'WS미디어';
    const structure = '문제 제기 -> 지역/상권 공감 -> 솔루션 제시(포커스미디어 엘리베이터TV) -> 미팅 제안';
    const extraLine = '- 포커스미디어는 아파트 단지 엘리베이터 동영상 광고로, 지역 타게팅(생활권/상권)이 매우 중요합니다.';

    return `
[역할]
당신은 B2B 전문 세일즈 카피라이터입니다. 정중하고 설득력 있는 톤앤매너를 유지하세요.

[상황]
저는 ${organizationLabel}의 미디어 컨설턴트입니다.
현재 '${lead.ai_analysis.company_name}'의 마케팅 담당자에게 '${productLabel}' 광고 상품을 제안하려 합니다.

[타겟 기업 정보]
- 기업명: ${lead.ai_analysis.company_name}
- 최근 이슈: ${lead.ai_analysis.event_summary}
- 예상 타겟: ${lead.ai_analysis.target_audience}

[제안 핵심 논리 (Sales Angle)]
"${lead.ai_analysis.sales_angle}"
${extraLine}

[선택 템플릿]
- 템플릿명: ${templateName}
- 지시사항:
${templateInstruction}

[요청사항]
위 정보를 바탕으로, 담당자가 이 메일을 읽고 "한번 만나서 들어보고 싶다"는 생각이 들도록 매력적인 콜드메일 초안을 작성해주세요.
1. 클릭을 유도하는 매력적인 메일 제목 후보 3가지를 먼저 제시해주세요.
2. 본문은 ${structure} 구조로 작성해주세요.
3. 지역 타게팅(서울/경기/인천/생활권/상권) 중요도를 본문에 포함해주세요.
4. 메일 작성 시 ** 기호 등 마크다운 서식을 절대 사용하지 말고, 순수 텍스트로만 작성해주세요.
5. 결과는 아래 형식을 정확히 지켜주세요.
subject_1: ...
subject_2: ...
subject_3: ...

body:
...
`.trim();
  }

  function handleCopyChatGptPrompt() {
    if (!selectedLead) return;
    const prompt = buildChatGptPrompt(selectedLead);
    navigator.clipboard.writeText(prompt);
    alert('ChatGPT용 프롬프트가 복사되었습니다.');
  }

  function normalizeDraftText(text: string) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.replace(/\s+$/g, ''))
      .join('\n');
  }

  function tidyParagraphs(text: string) {
    return normalizeDraftText(text)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function formatDraftForEditor(text: string) {
    const normalized = normalizeDraftText(text).trim();
    if (!normalized) return '';

    const lines = normalized.split('\n');
    const subjectLines = lines
      .filter((line) => /^subject_[1-3]\s*:/i.test(line.trim()))
      .map((line) => line.trim());
    const bodyIndex = lines.findIndex((line) => line.trim().toLowerCase() === 'body:');

    if (subjectLines.length > 0 && bodyIndex >= 0) {
      const bodyText = tidyParagraphs(lines.slice(bodyIndex + 1).join('\n'));
      return [...subjectLines, '', 'body:', '', bodyText].join('\n').trim();
    }

    return tidyParagraphs(normalized);
  }

  function parseDraftForMail(text: string) {
    const normalized = normalizeDraftText(text);
    const lines = normalized.split('\n');
    const subjectLine = lines.find((line) => line.trim().toLowerCase().startsWith('subject_1:'));
    const subject = subjectLine ? subjectLine.replace(/^subject_1:\s*/i, '').trim() : '';

    const bodyIndex = lines.findIndex((line) => line.trim().toLowerCase() === 'body:');
    const body = bodyIndex >= 0
      ? tidyParagraphs(lines.slice(bodyIndex + 1).join('\n'))
      : tidyParagraphs(normalized);

    return { subject, body };
  }

  function buildClipboardDraft(text: string) {
    const { subject, body } = parseDraftForMail(text);
    if (subject && body) return [`제목: ${subject}`, '', body].join('\n').trim();
    if (subject) return `제목: ${subject}`;
    return body;
  }

  async function handleCopyEmailDraft() {
    if (!selectedLead || !emailDraft.trim()) return;
    const clipboardText = buildClipboardDraft(emailDraft);
    await navigator.clipboard.writeText(clipboardText);
    const { subject } = parseDraftForMail(emailDraft);
    await logOutreach(selectedLead.lead_id, subject);
    alert('줄바꿈이 정리된 이메일 초안이 복사되었습니다. 아웃리치 이력이 기록되었습니다.');
  }

  async function handleOpenMailto() {
    if (!selectedLead) return;
    const candidateEmail =
      selectedLead.enrichment?.primary_email ||
      selectedLead.ai_analysis.contact_email ||
      selectedLead.enrichment?.emails?.[0] ||
      '';

    if (!candidateEmail) {
      alert('발송할 이메일 주소가 없습니다.');
      return;
    }

    const { subject, body } = parseDraftForMail(emailDraft);
    const mailto = `mailto:${encodeURIComponent(candidateEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, '_blank');
    await logOutreach(selectedLead.lead_id, subject);
  }

  async function handleBulkEnrichSelected() {
    const selected = getSelectedLeadsInfo();
    const targets = selected.filter((lead) => lead.ai_analysis.homepage_url);

    if (targets.length === 0) {
      alert('선택한 리드 중 홈페이지 URL이 있는 항목이 없습니다.');
      return;
    }

    setBulkEnriching(true);
    try {
      const res = await fetch('/api/sales/leads/bulk-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: targets.map((lead) => lead.lead_id) }),
      });

      if (!res.ok) {
        throw new Error('Bulk enrich failed');
      }

      const data = await res.json();
      await loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);

      if (selectedLead) {
        const refreshed = (data.results || []).find((item: { leadId: string }) => item.leadId === selectedLead.lead_id);
        if (refreshed) {
          const sourceQuery = sourceFilter !== 'ALL' ? `&source=${sourceFilter}` : '';
          const mediaTypeQuery = mediaTypeFilter !== 'ALL' ? `&mediaType=${mediaTypeFilter}` : '';
          const detailRes = await fetch(`/api/sales/leads?status=${currentStatus}&sortBy=${sortBy}${sourceQuery}${mediaTypeQuery}&limit=100`);
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            const latestSelected = (detailData.leads || []).find((lead: Lead) => lead.lead_id === selectedLead.lead_id);
            if (latestSelected) {
              setSelectedLead(latestSelected);
            }
          }
        }
      }

      alert(`일괄 크롤링 완료: 성공 ${data.successCount}건 / 실패 ${data.failureCount}건`);
    } catch (error) {
      console.error('Bulk enrich failed:', error);
      alert('일괄 크롤링 중 오류가 발생했습니다.');
    } finally {
      setBulkEnriching(false);
    }
  }

  async function handleUpdateStatus(newStatus: string) {
    if (!selectedLead) return;

    try {
      const res = await fetch(
        `/api/sales/leads/${selectedLead.lead_id}/state`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (res.ok) {
        loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
        setSelectedLead({ ...selectedLead, state: { ...selectedLead.state, status: newStatus } });
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  async function handleExcludeLead(lead: Lead) {
    const nextStatus = lead.state.status === LeadStatus.EXCLUDED ? 'NEW' : 'EXCLUDED';
    try {
      const res = await fetch(`/api/sales/leads/${lead.lead_id}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
      }
    } catch (error) {
      console.error('Failed to update exclude status:', error);
    }
  }

  async function handlePermanentExclude(lead: Lead) {
    const company = lead.ai_analysis.company_name?.trim();
    if (!company) {
      alert('기업명이 없어 영구 제외에 추가할 수 없습니다.');
      return;
    }

    try {
      const lowerCompany = company.toLowerCase();
      const isExcluded = excludedCompanies.some(
        (name) => name.toLowerCase() === lowerCompany
      );

      if (isExcluded) {
        const remaining = excludedCompanies.filter(
          (name) => name.toLowerCase() !== lowerCompany
        );
        await updateExcludedConfig({ replacePermanent: remaining });
      } else {
        await updateExcludedConfig({ permanent: [company] });
        if (lead.state.status !== LeadStatus.EXCLUDED) {
          await handleExcludeLead(lead);
        }
      }

      loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
    } catch (error) {
      console.error('Failed to permanently exclude company:', error);
      alert('영구 제외 처리 중 오류가 발생했습니다.');
    }
  }

  async function handleRemovePermanentCompany(company: string) {
    const remaining = excludedCompanies.filter(
      (name) => name.toLowerCase() !== company.toLowerCase()
    );
    try {
      await updateExcludedConfig({ replacePermanent: remaining });
    } catch (error) {
      console.error('Failed to remove permanent exclusion:', error);
      alert('영구 제외 해제 중 오류가 발생했습니다.');
    }
  }

  async function handleUpdateAssignedTo(assignedTo: string) {
    if (!selectedLead) return;

    try {
      const res = await fetch(
        `/api/sales/leads/${selectedLead.lead_id}/state`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assigned_to: assignedTo }),
        }
      );

      if (res.ok) {
        loadLeads(currentStatus, sortBy, sourceFilter, mediaTypeFilter);
        setSelectedLead({ ...selectedLead, state: { ...selectedLead.state, assigned_to: assignedTo } });
      }
    } catch (error) {
      console.error('Failed to update assigned_to:', error);
    }
  }

  const selectedCompanyNames = getSelectedCompanyNames();
  const hasExcludedSelected = leads.some(
    (lead) => selectedLeads.has(lead.lead_id) && lead.state.status === LeadStatus.EXCLUDED
  );
  const hasPermanentSelected = selectedCompanyNames.some((name) =>
    excludedCompanies.some((company) => company.toLowerCase() === name.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">

      {/* Scan Controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 lg:px-8 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">스캔 대상</label>
            <select
              value={scanTarget}
              onChange={(e) => {
                const nextTarget = e.target.value as ScanTargetType;
                setScanTarget(nextTarget);
                if (nextTarget !== 'RSS') {
                  setSelectedRssFeedUrl('ALL');
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">전체 소스</option>
              <option value="NAVER">네이버 뉴스</option>
              <option value="RSS">RSS 피드</option>
            </select>
          </div>

          {scanTarget === 'RSS' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">RSS 피드</label>
              <select
                value={selectedRssFeedUrl}
                onChange={(e) => setSelectedRssFeedUrl(e.target.value)}
                className="min-w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">전체 RSS 피드</option>
                {scanRssFeeds.map((feed) => (
                  <option key={`${feed.url}::${feed.title}`} value={feed.url}>
                    {feed.category ? `[${feed.category}] ` : ''}{feed.title || feed.url}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
            title="선택한 소스만 즉시 스캔"
          >
            {scanning ? '스캔 중...' : '📥 개별 스캔'}
          </button>

          <button
            onClick={handleAutoFullScan}
            disabled={scanning && !autoScanning}
            className={`px-4 py-2 text-white rounded-lg font-medium transition-colors text-sm ${autoScanning ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            title="모든 소스를 순차 스캔 (15초 간격)"
          >
            {autoScanning ? '🛑 전체 스캔 중단' : '🔥 전체 스캔'}
          </button>

          <button
            onClick={handleSmartQueueScan}
            disabled={(scanning || autoScanning) && !smartScanning}
            className={`px-4 py-2 text-white rounded-lg font-medium transition-colors text-sm shadow-md ${smartScanning ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-600 hover:bg-purple-700'
              }`}
            title="큐에 쌓인 항목들을 Time-Budget 방식으로 빠르게 처리 (50초씩 최대한 처리)"
          >
            {smartScanning ? '🛑 큐 처리 중단' : `⚡ 스마트 큐 처리 (${queueLength ?? '-'})`}
          </button>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">최소 점수</label>
            <input
              type="number"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {scanStatus && (
            <span className="text-xs font-semibold text-blue-600 animate-pulse">
              {scanStatus}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <a
              href="/ws_media_miner.zip"
              download
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm whitespace-nowrap"
            >
              ⬇ ws_media_miner.ZIP
            </a>
            <Link
              href="/sales/manual"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm whitespace-nowrap"
            >
              📘 사용 매뉴얼
            </Link>
          </div>

          <span className="text-xs text-gray-400 hidden xl:inline">
            ⚡ 스마트 큐 처리: Time-Budget (50초) 활용하여 고속 처리
          </span>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 lg:px-8 flex-shrink-0 flex items-center justify-between">
        <div className="flex overflow-x-auto">
          {STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => {
                setCurrentStatus(status);
                loadLeads(status, sortBy, sourceFilter, mediaTypeFilter);
              }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${currentStatus === status
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {STATUS_LABELS[status]}
              <span className="ml-2 text-[10px] font-semibold text-gray-400">
                {status === 'PERMANENT_EXCLUDED'
                  ? excludedCompanies.length
                  : statusCounts[status] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6 lg:p-8 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 h-full min-h-0">
          {/* Leads List */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-h-0">
            <div className="p-5 border-b border-gray-200 flex flex-col gap-4 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">
                  광고주 후보 목록 ({leads.length})
                </h2>
                <div className="flex items-center gap-2">
                  <select
                    value={mediaTypeFilter}
                    onChange={(e) => setMediaTypeFilter(e.target.value as LeadPathType)}
                    className="px-3 py-1 text-xs font-bold rounded-lg border border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="ALL">모든 매체</option>
                    <option value="FOCUS_MEDIA">포커스미디어</option>
                  </select>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="px-3 py-1 text-xs font-bold rounded-lg border border-gray-200 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                    <button
                      onClick={() => setSortBy('latest')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${sortBy === 'latest' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      최신순
                    </button>
                    <button
                      onClick={() => setSortBy('score')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${sortBy === 'score' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      점수순
                    </button>
                  </div>
                </div>
              </div>

              {currentStatus !== 'PERMANENT_EXCLUDED' && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm">
                    <input
                      type="checkbox"
                      id="selectAllLeads"
                      checked={leads.length > 0 && selectedLeads.size === leads.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="selectAllLeads" className="text-xs font-bold text-gray-700 cursor-pointer select-none">전체 선택</label>
                  </div>

                  <div className="text-[10px] text-gray-400 font-medium">
                    {sortBy === 'score' ? '* 점수 상위 200개 중 정렬' : '* 최신 50개 표시'}
                  </div>
                </div>
              )}
            </div>

            {currentStatus === 'PERMANENT_EXCLUDED' ? (
              <div className="flex-1 overflow-y-auto p-5">
                <div className="text-xs font-semibold text-gray-500 mb-3">
                  영구 제외 기업 ({excludedCompanies.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {excludedCompanies.length === 0 ? (
                    <span className="text-xs text-gray-400">등록된 기업 없음</span>
                  ) : (
                    excludedCompanies.map((company, index) => (
                      <span
                        key={`${company}-${index}`}
                        className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-gray-100 text-gray-600"
                      >
                        {company}
                        <button
                          onClick={() => handleRemovePermanentCompany(company)}
                          className="text-gray-400 hover:text-red-600"
                          title="영구 제외 해제"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100 min-h-0">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">로딩 중...</div>
                ) : leads.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    광고주 후보가 없습니다. 스캔을 실행하세요.
                  </div>
                ) : (
                  leads.map((lead) => {
                    const isExcluded = lead.state.status === LeadStatus.EXCLUDED;
                    const isPermanentExcluded = excludedCompanies.some(
                      (company) =>
                        company.toLowerCase() === lead.ai_analysis.company_name?.trim().toLowerCase()
                    );

                    return (
                      <div
                        key={lead.lead_id}
                        className={`border-b border-gray-100 hover:bg-slate-50 transition-colors group relative flex items-center ${selectedLeads.has(lead.lead_id) ? 'bg-blue-50/50' : ''}`}
                      >
                        <div className="pl-5 pr-3 py-5 flex items-center h-full">
                          <input
                            type="checkbox"
                            checked={selectedLeads.has(lead.lead_id)}
                            onChange={() => toggleSelectLead(lead.lead_id)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </div>

                        <div
                          className="flex-1 px-5 py-5 cursor-pointer"
                          onClick={() => {
                            setSelectedLead(lead);
                            loadNotes(lead.lead_id);
                          }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                                {lead.ai_analysis.company_name}
                              </h3>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {lead.title.includes('|') ? (
                                  <>
                                    <span className="font-bold text-gray-700">{lead.title.split('|')[0]}</span>
                                    <span className="text-gray-400 mx-1">|</span>
                                    <span>{lead.title.split('|')[1]}</span>
                                  </>
                                ) : lead.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black shadow-sm">
                                  {lead.final_score}점
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    normalizeLeadMediaType(lead.media_type) === 'FOCUS_MEDIA'
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                  }`}
                                >
                                  {mediaTypeLabel(lead.media_type)}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${lead.state.status === LeadStatus.EXCLUDED
                                  ? 'bg-gray-100 text-gray-600 border-gray-200'
                                  : 'bg-blue-100 text-blue-700 border-blue-200'
                                  }`}>
                                  {STATUS_LABELS[lead.state.status]}
                                </span>
                                {lead.source === 'YOUTUBE_AD' ? (
                                  <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold border border-red-100 flex items-center gap-1">
                                    <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" /></svg>
                                    YouTube
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                                    🔍 {lead.source}
                                  </span>
                                )}
                                {lead.keyword && (
                                  <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 text-[10px] font-bold border border-orange-100">
                                    # {lead.keyword}
                                  </span>
                                )}
                                {lead.state.assigned_to && (
                                  <span className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    {lead.state.assigned_to}
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400">
                                  {formatKST(lead.state.analyzed_at || lead.created_at)}
                                </span>
                                {lead.state.last_contacted_at && (
                                  <>
                                    <span className="text-[10px] text-gray-400">•</span>
                                    <span className="text-[10px] text-indigo-600 font-semibold">
                                      최근 연락: {formatRelativeFromNow(lead.state.last_contacted_at)}
                                    </span>
                                  </>
                                )}
                                {lead.notes_count > 0 && (
                                  <>
                                    <span className="text-[10px] text-gray-400">•</span>
                                    <span className="text-[10px] text-gray-500">💬 {lead.notes_count}</span>
                                  </>
                                )}
                              </div>

                              {/* Contact Bar */}
                              <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-gray-50">
                                {lead.ai_analysis.pr_agency ? (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-50 text-yellow-700 text-[10px] font-bold rounded border border-yellow-100">
                                    📣 PR: {lead.ai_analysis.pr_agency}
                                  </span>
                                ) : null}

                                {lead.ai_analysis.contact_email ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyEmail(lead.ai_analysis.contact_email!);
                                    }}
                                    className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100 hover:bg-blue-100 transition-colors"
                                    title="이메일 복사"
                                  >
                                    ✉️ {lead.ai_analysis.contact_email}
                                  </button>
                                ) : null}

                                {lead.ai_analysis.contact_phone ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyPhone(lead.ai_analysis.contact_phone!);
                                    }}
                                    className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded border border-green-100 hover:bg-green-100 transition-colors"
                                    title="연락처 복사"
                                  >
                                    📞 {lead.ai_analysis.contact_phone}
                                  </button>
                                ) : null}

                                {normalizeExternalUrl(lead.ai_analysis.homepage_url) ? (
                                  <a
                                    href={normalizeExternalUrl(lead.ai_analysis.homepage_url)!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 text-slate-700 text-[10px] font-bold rounded border border-slate-100 hover:bg-slate-100 transition-colors"
                                  >
                                    🌐 홈페이지
                                  </a>
                                ) : null}

                                <a
                                  href={lead.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 text-slate-700 text-[10px] font-bold rounded border border-slate-100 hover:bg-slate-100 transition-colors ml-auto"
                                >
                                  🔗 원문
                                </a>

                                {!lead.ai_analysis.contact_email && !normalizeExternalUrl(lead.ai_analysis.homepage_url) && (
                                  <span className="text-[10px] text-orange-400 font-medium italic">
                                    ⚠️ 홈페이지 확인 필요
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExcludeLead(lead);
                                }}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-all text-xs font-semibold ${isExcluded
                                  ? 'bg-orange-50 text-orange-600 border-orange-200'
                                  : 'bg-white text-gray-400 border-gray-200 hover:border-orange-300 hover:text-orange-600'
                                  }`}
                                title="제외"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                                제외
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePermanentExclude(lead);
                                }}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-all text-xs font-semibold ${isPermanentExcluded
                                  ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                                  : 'border-gray-200 bg-white text-gray-400 hover:border-red-300 hover:text-red-600'
                                  }`}
                                title="영구 제외"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 4h.01M9.172 9.172a4 4 0 015.656 0m0 0L12 12m2.828-2.828a4 4 0 010 5.656M6 6l12 12" />
                                </svg>
                                영구 제외
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLead(lead.lead_id);
                                }}
                                className="p-1.5 bg-white text-gray-400 border border-gray-200 rounded-lg hover:border-red-300 hover:text-red-600 transition-all"
                                title="삭제"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Lead Detail */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-h-0">
            {selectedLead ? (
              <div className="h-full flex flex-col">
                <div className="p-5 border-b border-gray-200">
                  <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <span className="bg-blue-600 text-white text-xs font-black px-2 py-1 rounded-lg shadow-sm">
                      {selectedLead.final_score}점
                    </span>
                    {selectedLead.title}
                  </h2>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <select
                      value={selectedLead.state.status}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                    >
                      {STATUSES.filter((s) => s !== 'ALL' && s !== 'PERMANENT_EXCLUDED').map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="담당자"
                      defaultValue={selectedLead.state.assigned_to || ''}
                      onBlur={(e) => handleUpdateAssignedTo(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm w-24"
                    />

                    <span className="text-[10px] text-gray-400 hidden lg:inline pt-1.5">
                      → 담당자 지정 및 광고주 후보 분류
                    </span>
                  </div>

                  <a
                    href={selectedLead.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    원문 보기 →
                  </a>
                </div>

                <div className="flex-1 overflow-y-auto p-5 lg:p-6 space-y-5 min-h-0">
                  {/* Metadata Bar */}
                  <div className="flex items-center gap-4 py-3 px-4 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">수집 출처</span>
                      <span className="text-xs font-bold text-slate-700 truncate">{selectedLead.source}</span>
                    </div>
                    {selectedLead.keyword && (
                      <>
                        <div className="h-6 w-px bg-slate-200 mx-1"></div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">검색 키워드</span>
                          <span className="text-xs font-bold text-orange-600 truncate">{selectedLead.keyword}</span>
                        </div>
                      </>
                    )}
                    <div className="h-6 w-px bg-slate-200 mx-1 ml-auto"></div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">게시일</span>
                      <span className="text-xs font-bold text-slate-700">{formatKST(selectedLead.pubDate)}</span>
                    </div>
                  </div>

                  {/* AI Analysis */}
                  <div className="space-y-4 text-sm leading-6">
                    <div>
                      <div className="font-semibold text-gray-700">평가 경로</div>
                      <div className="text-gray-900">
                        {mediaTypeLabel(selectedLead.media_type)}
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-gray-700">회사명</div>
                      <div className="text-gray-900">
                        {selectedLead.ai_analysis.company_name}
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-gray-700">이벤트 요약</div>
                      <div className="text-gray-900">
                        {selectedLead.ai_analysis.event_summary}
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-gray-700">타겟 고객층</div>
                      <div className="text-gray-900">
                        {selectedLead.ai_analysis.target_audience}
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-gray-700">적합 이유</div>
                      <div className="text-gray-900">
                        {selectedLead.ai_analysis.atv_fit_reason}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-bold text-slate-400 uppercase">AI 이메일 초안</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopyChatGptPrompt}
                            className="text-xs px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-800 text-white font-medium transition-colors"
                          >
                            ChatGPT 프롬프트 복사(생성과 동일)
                          </button>
                          <select
                            value={selectedTemplateId}
                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                            className="text-xs px-2 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700"
                          >
                            {emailTemplates.filter((template) => template.mediaType === normalizeLeadMediaType(selectedLead.media_type)).length === 0 ? (
                              <option value="">기본 템플릿</option>
                            ) : (
                              emailTemplates
                                .filter((template) => template.mediaType === normalizeLeadMediaType(selectedLead.media_type))
                                .map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                                ))
                            )}
                          </select>
                          <button
                            onClick={handleGenerateEmailDraft}
                            disabled={emailGenerating}
                            className="text-xs px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <span>{emailGenerating ? '생성 중...' : 'AI 초안 생성'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <p className="font-semibold text-slate-800 mb-2 text-sm">Sales Angle</p>
                        <p className="text-sm text-slate-600 leading-relaxed mb-3">
                          {selectedLead.ai_analysis.sales_angle}
                        </p>
                        <textarea
                          value={emailDraft}
                          onChange={(e) => setEmailDraft(normalizeDraftText(e.target.value))}
                          placeholder="AI 초안을 생성하면 여기에 표시됩니다. 필요하면 바로 수정하세요."
                          className="w-full min-h-52 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            onClick={handleCopyEmailDraft}
                            disabled={!emailDraft.trim()}
                            className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold transition-colors shadow-sm ring-2 ring-blue-100"
                          >
                            📋 이메일 복사
                          </button>
                          <button
                            onClick={handleOpenMailto}
                            disabled={!emailDraft.trim()}
                            className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-medium transition-colors"
                          >
                            mailto 열기
                          </button>
                          <span className="text-[11px] text-slate-500">
                            복사 시 제목/본문 줄바꿈이 자동 정리됩니다.
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Contact Information & Homepage Enrichment */}
                    <div className="border-t border-slate-100 pt-4 mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-bold text-slate-400 uppercase">
                          📇 연락처 정보
                        </div>
                        {selectedLead.ai_analysis.homepage_url && (
                          <button
                            onClick={handleEnrichHomepage}
                            disabled={enriching}
                            className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-medium transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            {enriching ? (
                              <>
                                <span className="animate-spin">🔄</span>
                                <span>크롤링 중...</span>
                              </>
                            ) : (
                              <>
                                <span>🌐</span>
                                <span>홈페이지 크롤링</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {/* Basic Contact Info from AI */}
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                          <div className="text-[10px] font-bold text-blue-600 uppercase mb-2">
                            📰 뉴스 기사에서 추출
                          </div>
                          <div className="space-y-1.5 text-sm">
                            {selectedLead.ai_analysis.contact_email ? (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600">📧 이메일:</span>
                                <button
                                  onClick={() => handleCopyEmail(selectedLead.ai_analysis.contact_email!)}
                                  className="text-blue-700 hover:text-blue-900 font-medium hover:underline"
                                >
                                  {selectedLead.ai_analysis.contact_email}
                                </button>
                              </div>
                            ) : null}
                            {selectedLead.ai_analysis.contact_phone ? (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600">📞 전화:</span>
                                <button
                                  onClick={() => handleCopyPhone(selectedLead.ai_analysis.contact_phone!)}
                                  className="text-green-700 hover:text-green-900 font-medium hover:underline"
                                >
                                  {selectedLead.ai_analysis.contact_phone}
                                </button>
                              </div>
                            ) : null}
                            {normalizeExternalUrl(selectedLead.ai_analysis.homepage_url) ? (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600">🌐 홈페이지:</span>
                                <a
                                  href={normalizeExternalUrl(selectedLead.ai_analysis.homepage_url)!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-700 hover:text-slate-900 font-medium hover:underline"
                                >
                                  {normalizeExternalUrl(selectedLead.ai_analysis.homepage_url)}
                                </a>
                              </div>
                            ) : null}
                            {selectedLead.ai_analysis.pr_agency ? (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600">📣 PR 대행사:</span>
                                <span className="text-yellow-700 font-medium">
                                  {selectedLead.ai_analysis.pr_agency}
                                </span>
                              </div>
                            ) : null}
                            {!selectedLead.ai_analysis.contact_email &&
                             !selectedLead.ai_analysis.contact_phone &&
                             !normalizeExternalUrl(selectedLead.ai_analysis.homepage_url) ? (
                              <div className="text-gray-500 italic text-xs">
                                기사에서 연락처를 찾지 못했습니다.
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* Enriched Contact Info from Homepage Crawling */}
                        {selectedLead.enrichment && selectedLead.enrichment.success ? (
                          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                            <div className="text-[10px] font-bold text-emerald-600 uppercase mb-2">
                              🌐 홈페이지에서 수집 ({new Date(selectedLead.enrichment.scraped_at).toLocaleString('ko-KR')})
                            </div>
                            <div className="space-y-2 text-sm">
                              {selectedLead.enrichment.title && (
                                <div>
                                  <span className="text-gray-600 text-xs font-semibold">사이트 제목:</span>
                                  <div className="text-gray-800 mt-0.5">{selectedLead.enrichment.title}</div>
                                </div>
                              )}
                              {selectedLead.enrichment.description && (
                                <div>
                                  <span className="text-gray-600 text-xs font-semibold">사이트 설명:</span>
                                  <div className="text-gray-800 mt-0.5 text-xs">{selectedLead.enrichment.description}</div>
                                </div>
                              )}
                              {selectedLead.enrichment.company_overview && (
                                <div>
                                  <span className="text-gray-600 text-xs font-semibold">기업 소개 요약:</span>
                                  <div className="text-gray-800 mt-0.5 text-xs">{selectedLead.enrichment.company_overview}</div>
                                </div>
                              )}
                              {selectedLead.enrichment.pages_crawled ? (
                                <div>
                                  <span className="text-gray-600 text-xs font-semibold">크롤링 페이지:</span>
                                  <span className="text-gray-800 ml-1 text-xs">{selectedLead.enrichment.pages_crawled}개</span>
                                </div>
                              ) : null}
                              {selectedLead.enrichment.key_services && selectedLead.enrichment.key_services.length > 0 ? (
                                <div>
                                  <span className="text-gray-600 text-xs font-semibold">주요 서비스:</span>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {selectedLead.enrichment.key_services.slice(0, 6).map((service, idx) => (
                                      <span
                                        key={idx}
                                        className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded font-medium"
                                      >
                                        {service}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {selectedLead.enrichment.emails.length > 0 && (
                                <div>
                                  <span className="text-gray-600 text-xs font-semibold">
                                    📧 이메일 ({selectedLead.enrichment.emails.length}개):
                                  </span>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {selectedLead.enrichment.emails.map((email, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() => handleCopyEmail(email)}
                                        className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded font-medium transition-colors"
                                      >
                                        {email}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {selectedLead.enrichment.phones.length > 0 && (
                                <div>
                                  <span className="text-gray-600 text-xs font-semibold">
                                    📞 전화번호 ({selectedLead.enrichment.phones.length}개):
                                  </span>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {selectedLead.enrichment.phones.map((phone, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() => handleCopyPhone(phone)}
                                        className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded font-medium transition-colors"
                                      >
                                        {phone}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {selectedLead.enrichment.emails.length === 0 && selectedLead.enrichment.phones.length === 0 && (
                                <div className="text-gray-500 italic text-xs">
                                  홈페이지에서 추가 연락처를 찾지 못했습니다.
                                </div>
                              )}
                            </div>
                          </div>
                        ) : selectedLead.enrichment && !selectedLead.enrichment.success ? (
                          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                            <div className="text-[10px] font-bold text-red-600 uppercase mb-1">
                              ⚠️ 크롤링 실패
                            </div>
                            <div className="text-xs text-red-700">
                              {selectedLead.enrichment.error || '알 수 없는 오류'}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm">아웃리치 이력</h3>
                    {selectedLead.outreach_log && selectedLead.outreach_log.length > 0 ? (
                      <div className="space-y-2">
                        {selectedLead.outreach_log.map((log) => (
                          <div key={log.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-slate-700">
                                {log.type.toUpperCase()} · {log.status}
                              </span>
                              <span className="text-[11px] text-slate-500">{formatKST(log.sent_at)}</span>
                            </div>
                            {log.subject && (
                              <p className="mt-1 text-xs text-slate-700 line-clamp-2">{log.subject}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">기록된 아웃리치가 없습니다.</div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      메모 ({notes.length})
                    </h3>

                    <div className="space-y-2 mb-3">
                      {notes.map((note) => (
                        <div
                          key={note.id}
                          className="p-3 bg-gray-50 rounded-lg text-sm"
                        >
                          <div className="text-gray-900">{note.content}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(note.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && handleAddNote()
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="메모 추가..."
                      />
                      <button
                        onClick={handleAddNote}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                      >
                        추가
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                광고주 후보를 선택하세요
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Floating Bulk Action Bar */}
      {
        selectedLeads.size > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3">
              <span className="bg-blue-600 text-[10px] font-bold px-2 py-1 rounded-full">{selectedLeads.size}</span>
              <span className="text-sm font-medium">개 광고주 후보 선택됨</span>
            </div>

            <div className="flex items-center gap-2 border-l border-gray-700 pl-8">
              <button
                onClick={() => handleBulkTemporaryExclude(7)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white rounded-lg transition-all text-xs font-semibold"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                7일 제외
              </button>
              <button
                onClick={handleBulkPermanentExclude}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-white rounded-lg transition-all text-xs font-semibold"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                영구 제외
              </button>
              {hasExcludedSelected && (
                <button
                  onClick={handleBulkRestoreExcluded}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg transition-all text-xs font-semibold"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12a8 8 0 018-8m0 0l-3 3m3-3l3 3m-3-3a8 8 0 018 8" />
                  </svg>
                  제외 해제
                </button>
              )}
              {hasPermanentSelected && (
                <button
                  onClick={handleBulkPermanentRestore}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg transition-all text-xs font-semibold"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  영구 제외 해제
                </button>
              )}
              <button
                onClick={handleBulkEnrichSelected}
                disabled={bulkEnriching}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500 text-cyan-300 hover:text-white disabled:bg-gray-600 disabled:text-gray-400 rounded-lg transition-all text-xs font-semibold"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-6.219-8.56M21 3v9h-9" />
                </svg>
                {bulkEnriching ? '크롤링 중...' : '선택 리드 일괄 크롤링'}
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all text-xs font-semibold"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                </svg>
                선택 삭제
              </button>

              <button
                onClick={() => setSelectedLeads(new Set())}
                className="px-3 py-2 text-gray-400 hover:text-white transition-colors text-xs"
              >
                취소
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
}
