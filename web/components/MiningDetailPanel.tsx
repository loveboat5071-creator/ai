'use client';

import { useState } from 'react';
import type { MinedBusiness, CrawlEnrichment, EmailDraft } from '@/lib/miningTypes';

const MINING_KEY = process.env.NEXT_PUBLIC_MINING_API_KEY || '';

interface Props {
  business: MinedBusiness | null;
  token?: string; // deprecated, kept for compat
  region: string;
  onEnrichmentComplete: (bizId: string, enrichment: CrawlEnrichment) => void;
  onDraftGenerated: (draft: EmailDraft) => void;
  onStatusChange: (bizId: string, status: MinedBusiness['status']) => void;
}

export default function MiningDetailPanel({
  business, token, region,
  onEnrichmentComplete, onDraftGenerated, onStatusChange,
}: Props) {
  const [isCrawling, setIsCrawling] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlEnrichment | null>(null);
  const [crawlError, setCrawlError] = useState('');

  if (!business) {
    return (
      <div style={{
        padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14,
      }}>
        ← 좌측에서 업체를 선택하면 상세 정보가 표시됩니다.
      </div>
    );
  }

  const handleCrawl = async () => {
    const urlToCrawl = business.homepageUrl || business.placeUrl;
    if (!urlToCrawl) return;
    setIsCrawling(true);
    setCrawlError('');
    try {
      const resp = await fetch('/api/mining/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Mining-Key': MINING_KEY,
        },
        body: JSON.stringify({ url: urlToCrawl, placeUrl: business.placeUrl }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'Crawl failed');
      setCrawlResult(data.enrichment);
      onEnrichmentComplete(business.id, data.enrichment);
      onStatusChange(business.id, 'crawled');
    } catch (e) {
      setCrawlError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsCrawling(false);
    }
  };

  const handleDraft = async () => {
    setIsDrafting(true);
    try {
      const resp = await fetch('/api/mining/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Mining-Key': MINING_KEY,
        },
        body: JSON.stringify({
          businessName: business.name,
          category: business.category,
          region,
          phone: business.phone,
          address: business.address,
          homepageUrl: business.homepageUrl,
          companyOverview: crawlResult?.companyOverview,
          keyServices: crawlResult?.keyServices,
          recipientEmail: crawlResult?.primaryEmail || (business.emails.length > 0 ? business.emails[0] : ''),
        }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'Draft failed');
      onDraftGenerated(data.draft);
      onStatusChange(business.id, 'drafted');
    } catch (e) {
      setCrawlError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsDrafting(false);
    }
  };

  const confidenceLabel: Record<string, { text: string; color: string }> = {
    HIGH:   { text: '높음 ✅', color: '#059669' },
    MEDIUM: { text: '보통 ⚠️', color: '#d97706' },
    LOW:    { text: '낮음 ❌', color: '#dc2626' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          {business.name}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{business.category}</div>
      </div>

      {/* Basic Info */}
      <div style={{
        padding: 14, borderRadius: 12, background: 'var(--bg-input)',
        display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13,
      }}>
        <div><strong>📍 주소:</strong> {business.address}</div>
        {business.phone && <div><strong>📞 전화:</strong> {business.phone}</div>}
        <div>
          <strong>🗺️ 카카오맵:</strong>{' '}
          <a href={business.placeUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            상세보기 →
          </a>
        </div>
        {business.homepageUrl && (
          <div>
            <strong>🌐 홈페이지:</strong>{' '}
            <a href={business.homepageUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
              {business.homepageUrl}
            </a>
          </div>
        )}
      </div>

      {/* Crawl Section */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={handleCrawl}
          disabled={isCrawling}
          style={{ flex: 1, fontSize: 13 }}
        >
          {isCrawling ? <><span className="loading-spinner" /> 크롤링 중...</> : '🔍 홈페이지 크롤링'}
        </button>
        <button
          className="btn"
          onClick={() => onStatusChange(business.id, 'skipped')}
          style={{ fontSize: 13, padding: '8px 14px' }}
        >
          건너뛰기
        </button>
      </div>

      {crawlError && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)',
          color: '#dc2626', fontSize: 12,
        }}>
          ⚠️ {crawlError}
        </div>
      )}

      {/* Crawl Results */}
      {crawlResult && (
        <div style={{
          padding: 14, borderRadius: 12, border: '1.5px solid rgba(5,150,105,0.2)',
          background: 'rgba(5,150,105,0.04)', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>
            ✅ 크롤링 완료 ({crawlResult.pagesCrawled}페이지)
          </div>

          {/* Contact Confidence */}
          <div style={{ fontSize: 12 }}>
            <strong>연락처 신뢰도:</strong>{' '}
            <span style={{ color: confidenceLabel[crawlResult.contactConfidence]?.color || '#6b7280' }}>
              {confidenceLabel[crawlResult.contactConfidence]?.text || crawlResult.contactConfidence}
            </span>
          </div>

          {/* Emails */}
          {crawlResult.emails.length > 0 && (
            <div style={{ fontSize: 12 }}>
              <strong>✉️ 이메일:</strong>
              {crawlResult.emails.map((email, i) => (
                <div key={i} style={{
                  display: 'inline-block', margin: '2px 4px', padding: '2px 8px',
                  background: 'rgba(37,99,235,0.1)', borderRadius: 6, color: '#2563eb', fontWeight: 500,
                }}>
                  {email}
                </div>
              ))}
            </div>
          )}

          {/* Phones */}
          {crawlResult.phones.length > 0 && (
            <div style={{ fontSize: 12 }}>
              <strong>📞 전화번호:</strong> {crawlResult.phones.join(', ')}
            </div>
          )}

          {/* Company Overview */}
          {crawlResult.companyOverview && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              <strong>기업 소개:</strong> {crawlResult.companyOverview}
            </div>
          )}

          {/* Key Services */}
          {crawlResult.keyServices.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong>주요 서비스:</strong> {crawlResult.keyServices.slice(0, 3).join(' / ')}
            </div>
          )}
        </div>
      )}

      {/* Draft Button */}
      {(crawlResult || business.emails.length > 0) && (
        <button
          className="btn btn-primary"
          onClick={handleDraft}
          disabled={isDrafting}
          style={{ fontSize: 13 }}
        >
          {isDrafting ? <><span className="loading-spinner" /> 초안 생성 중...</> : '✉️ 이메일 초안 생성'}
        </button>
      )}
    </div>
  );
}
