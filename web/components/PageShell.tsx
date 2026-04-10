import Link from 'next/link';
import type { ReactNode } from 'react';

import AppChrome, { appChromeNavItems, type AppChromeNavItem } from '@/components/AppChrome';

type PageShellProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  actions?: ReactNode;
  children: ReactNode;
  navItems?: AppChromeNavItem[];
  className?: string;
  [key: string]: unknown;
};

export default function PageShell({
  title,
  subtitle,
  backHref,
  actions,
  children,
  navItems = appChromeNavItems,
  className = '',
}: PageShellProps) {
  return (
    <AppChrome navItems={navItems}>
      <div className="h-full overflow-auto">
        <div className={`mx-auto w-full max-w-[1600px] px-5 py-6 lg:px-7 lg:py-8 ${className}`}>
          <section className="mb-5 rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm lg:mb-6 lg:px-7 lg:py-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                  WS MEDIA
                </div>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                  {backHref ? (
                    <Link
                      href={backHref}
                      className="inline-flex w-fit items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      뒤로
                    </Link>
                  ) : null}
                  <div className="min-w-0">
                    <h1 className="text-xl font-semibold text-slate-950 sm:text-2xl">
                      {title}
                    </h1>
                    {subtitle ? (
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                        {subtitle}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              {actions ? (
                <div className="flex w-full items-center justify-start lg:w-auto lg:justify-end">
                  {actions}
                </div>
              ) : null}
            </div>
          </section>
          {children}
        </div>
      </div>
    </AppChrome>
  );
}
