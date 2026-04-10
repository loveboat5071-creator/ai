import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import PageShell from "@/components/PageShell";

type ModuleItem = {
  id: string;
  label: string;
  href: string;
  route: string;
  summary: string;
  detail: string;
  accent: string;
};

const modules: ModuleItem[] = [
  {
    id: "01",
    label: "견적 / 기획",
    href: "/proposal",
    route: "/proposal",
    summary: "반경과 지역 조건을 기반으로 제안 자료를 정리합니다.",
    detail: "보고서, PDF/PPT/Excel, 지역 검색",
    accent: "bg-blue-50 text-blue-700 ring-blue-100",
  },
  {
    id: "02",
    label: "소재 제작",
    href: "/creative",
    route: "/creative",
    summary: "시안 작성부터 생성과 검토 흐름까지 이어집니다.",
    detail: "Canva 초안, 자동 시안, 생성 관리",
    accent: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  {
    id: "03",
    label: "광고주 마이닝",
    href: "/mining",
    route: "/mining",
    summary: "지역과 업종 기준으로 잠재 광고주를 찾고 분류합니다.",
    detail: "지도 검색, 크롤링, 이메일 추출",
    accent: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  {
    id: "04",
    label: "영업 대시보드",
    href: "/sales",
    route: "/sales",
    summary: "리드 관리와 후속 액션, Ad Miner 운영을 연결합니다.",
    detail: "CRM, Ad Miner, AI 분석",
    accent: "bg-violet-50 text-violet-700 ring-violet-100",
  },
];

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5 lg:px-6">
        <h2 className="text-base font-semibold text-slate-950 sm:text-lg">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="p-4 sm:p-5 lg:p-6">{children}</div>
    </section>
  );
}

export const metadata: Metadata = {
  title: "WS MEDIA 통합 대시보드",
};

export default function HomePage() {
  return (
    <PageShell title="WS MEDIA 통합 대시보드">
      <Panel title="서비스 모듈">
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          {modules.map((module) => (
            <div
              key={module.href}
              className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6"
            >
              <div className="flex h-full flex-col gap-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${module.accent}`}
                    >
                      {module.id}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      {module.route}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-950 sm:text-2xl">
                    {module.label}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                    {module.summary}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{module.detail}</p>
                </div>
                <Link
                  href={module.href}
                  className="inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  바로 열기
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}
