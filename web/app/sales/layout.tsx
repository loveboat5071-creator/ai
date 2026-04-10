import type { ReactNode } from 'react';

import AppChrome, { appChromeNavItems } from '@/components/AppChrome';

interface SalesLayoutProps {
  children: ReactNode;
}

export default function SalesLayout({ children }: SalesLayoutProps) {
  return (
    <AppChrome
      navItems={appChromeNavItems}
      showLogout
      brandHref="/sales"
      brandLabel="WS MEDIA SALES TOOL"
      brandIcon="📺"
    >
      {children}
    </AppChrome>
  );
}
