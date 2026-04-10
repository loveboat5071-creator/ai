import PageShell from '@/components/PageShell';
import MiningWorkspace from '@/components/workspaces/MiningWorkspace';

export const metadata = {
  title: '광고주 마이닝 | 포커스미디어',
  description: '지역+업종 검색, 크롤링, 이메일 초안',
};

export default function MiningPage() {
  return (
    <PageShell title="광고주 마이닝" subtitle="지역+업종 검색, 크롤링, 이메일 초안" backHref="/">
      <MiningWorkspace />
    </PageShell>
  );
}
