import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';
import { getSite } from '@/lib/data/queries';
import { m } from '@/lib/i18n';

export const metadata: Metadata = { title: m.legal.privacy.title };

export default async function PrivacyPage() {
  const { data: site } = await getSite();
  return <LegalPage title={m.legal.privacy.title} intro={m.legal.privacy.intro} sections={m.legal.privacy.sections} settings={site.settings} />;
}
