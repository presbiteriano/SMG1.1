import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { TabLinks, type TabItem } from '@/components/tab-links';
import { Kicker, Pill } from '@/components/ui';
import { requireEdition } from '@/lib/data/public';
import { m } from '@/lib/i18n';
import { editionDates } from '@/lib/site';

type Props = { params: Promise<{ anno: string }>; children: ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data } = await requireEdition((await params).anno);
  return { title: { default: data.edition.name, template: `%s · ${data.edition.name}` } };
}

// Hub dell'edizione: stessa struttura per tutte le annate (brief 7.8).
export default async function EditionLayout({ params, children }: Props) {
  const { data } = await requireEdition((await params).anno);
  const { edition } = data;
  const base = `/edizioni/${edition.year}`;
  const hasKnockout = data.competitions.some((competition) => competition.stages.some((stage) => stage.kind !== 'group'));

  const tabs: TabItem[] = [
    { href: base, label: m.editions.overview, exact: true },
    { href: `${base}/calendario`, label: m.nav.results },
    { href: `${base}/classifica`, label: m.nav.standings },
    ...(hasKnockout ? [{ href: `${base}/tabellone`, label: m.nav.bracket }] : []),
    { href: `/squadre?edizione=${edition.year}`, label: m.nav.teams },
    ...(edition.config.features.stats ? [{ href: `/statistiche?edizione=${edition.year}`, label: m.nav.stats }] : []),
    { href: `/foto?edizione=${edition.year}`, label: m.nav.photos },
  ];

  return (
    <>
      <div className="bg-surface-2">
        <div className="container-page flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3 sm:py-5">
          <div>
            <Kicker className="hidden text-link sm:block">{editionDates(edition)}</Kicker>
            <p className="display text-2xl sm:mt-1 sm:text-5xl">{edition.name}</p>
          </div>
          <Pill tone={edition.status === 'live' ? 'ink' : 'outline'}>{m.status.edition[edition.status]}</Pill>
        </div>
        <TabLinks items={tabs} label={m.editions.tabs} />
      </div>
      {children}
    </>
  );
}
