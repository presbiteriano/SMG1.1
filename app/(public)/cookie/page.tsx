import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';
import { getSite } from '@/lib/data/queries';
import { m } from '@/lib/i18n';

export const metadata: Metadata = { title: m.legal.cookie.title };

export default async function CookiePage() {
  const { data: site } = await getSite();
  return <LegalPage title={m.legal.cookie.title} intro={m.legal.cookie.intro} sections={m.legal.cookie.sections} settings={site.settings} />;
}
