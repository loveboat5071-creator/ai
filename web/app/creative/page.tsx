import PageShell from '@/components/PageShell';
import CreativeWorkspace from '@/components/workspaces/CreativeWorkspace';

export const metadata = {
  title: '소재 제작 | 포커스미디어',
  description: 'Canva 초안, 자동 시안, 연동',
};

export default function CreativePage() {
  return (
    <PageShell title="소재 제작" subtitle="Canva 초안, 자동 시안, 연동" backHref="/">
      <CreativeWorkspace />
    </PageShell>
  );
}
