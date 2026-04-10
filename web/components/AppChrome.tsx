'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type AppChromeNavItem = {
  href: string;
  label: string;
  icon: string;
  external?: boolean;
  matchMode?: 'exact' | 'prefix';
};

type AppChromeProps = {
  children: ReactNode;
  navItems?: AppChromeNavItem[];
  showLogout?: boolean;
  brandHref?: string;
  brandLabel?: string;
  brandIcon?: string;
};

export const appChromeNavItems: AppChromeNavItem[] = [
  { href: '/', label: '대시보드', icon: '🏠', matchMode: 'exact' },
  { href: '/proposal', label: '견적', icon: '🧾' },
  { href: '/creative', label: '소재', icon: '🎨' },
  { href: '/mining', label: '마이닝', icon: '🔎' },
  { href: '/sales', label: '영업', icon: '📊' },
  { href: '/sales/settings', label: '영업 설정', icon: '⚙️' },
  { href: '/sales/manual', label: 'Ad Miner', icon: '🧩' },
  { href: '/admin', label: '관리자', icon: '🛠️' },
  { href: '/history', label: '작업 로그', icon: '🕘' },
  { href: 'https://t.me/focusmedia_support_bot', label: 'Telegram', icon: '📨', external: true },
];

function navItemIsActive(pathname: string, item: AppChromeNavItem): boolean {
  if (item.external) return false;
  if (item.matchMode === 'exact') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AppChrome({
  children,
  navItems = appChromeNavItems,
  showLogout = false,
  brandHref = '/',
  brandLabel = 'WS MEDIA SALES TOOL by LYJ',
  brandIcon = '📺',
}: AppChromeProps) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login?role=sales&next=%2Fsales');
    router.refresh();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 z-[60] flex-shrink-0">
        <button
          onClick={() => setSidebarOpen((open) => !open)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href={brandHref} className="ml-3 font-bold text-gray-900 flex items-center gap-2">
          <span className="text-xl">{brandIcon}</span>
          <span>{brandLabel}</span>
        </Link>
        {showLogout ? (
          <button
            onClick={handleLogout}
            className="ml-auto text-xs font-bold text-slate-500 hover:text-red-500"
          >
            로그아웃
          </button>
        ) : null}
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {sidebarOpen ? (
          <div
            className="fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside
          className={`
            fixed lg:static top-0 left-0 bottom-0 w-64 bg-slate-50 border-r border-gray-200 flex flex-col z-50
            transform transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:-translate-x-full lg:hidden'}
          `}
        >
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = navItemIsActive(pathname, item);
              const className = `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'}
              `;

              if (item.external) {
                return (
                  <a
                    key={`${item.label}-${item.href}`}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className={className}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </a>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={className}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 bg-white/50 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                W
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900 truncate">WS MEDIA</div>
                <div className="text-[10px] text-blue-600 font-black uppercase tracking-wider">Unified Workspace</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 bg-gray-50 relative overflow-hidden h-full">
          {children}
        </main>
      </div>
    </div>
  );
}
