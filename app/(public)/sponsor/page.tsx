import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import { SponsorGrid } from '@/components/sections';
import { buttonClass, EmptyState, PageHeader, SectionHeading } from '@/components/ui';
import { getPublicNumbers, getSite } from '@/lib/data/queries';
import { m } from '@/lib/i18n';
import { visibleSponsors } from '@/lib/site';

export const metadata: Metadata = { title: m.sponsors.title, description: m.sponsors.question };

// Sponsor e «diventa sponsor» (brief 7.10), con i numeri di visita aggregati da mostrare a chi sta valutando.
export default async function SponsorPage() {
  const { data: site } = await getSite();
  const sponsors = visibleSponsors(site, null, new Date());
  const numbers = site.settings.show_visit_numbers ? (await getPublicNumbers()).data : null;
  const figures = numbers
    ? [
        [numbers.pageviews, m.sponsors.pageviews],
        [numbers.entries, m.sponsors.entries],
        [numbers.instagram, m.sponsors.fromInstagram],
        [numbers.whatsapp, m.sponsors.fromWhatsapp],
        [numbers.sponsorClicks, m.sponsors.sponsorClicks],
        [numbers.shares, m.sponsors.shares],
      ].filter(([value]) => Number(value) > 0)
    : [];

  return (
    <>
      <PageHeader title={m.sponsors.title} question={m.sponsors.question} />
      <div className="container-page space-y-12 pb-10">
        {sponsors.length === 0 ? <EmptyState title={m.sponsors.empty} /> : <SponsorGrid sponsors={sponsors} />}

        <section aria-labelledby="diventa" className="floodlit rounded-card p-5 sm:p-8">
          <h2 id="diventa" className="text-4xl sm:text-5xl">
            {m.sponsors.becomeTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-lg">{m.sponsors.becomeText}</p>
          <ul className="mt-4 space-y-2">
            {m.sponsors.becomePoints.map((point) => (
              <li key={point} className="flex items-start gap-2 font-semibold">
                <Check aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={3} />
                {point}
              </li>
            ))}
          </ul>
          {site.settings.instagram_url ? (
            <a href={site.settings.instagram_url} rel="noopener" className={buttonClass('primary', 'mt-6')}>
              {m.sponsors.contactCta}
            </a>
          ) : null}
        </section>

        {figures.length > 0 ? (
          <section aria-labelledby="numeri">
            <SectionHeading id="numeri" title={m.sponsors.numbersTitle} />
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {figures.map(([value, label]) => (
                <div key={label} className="card p-4">
                  <dd className="display text-5xl tabular-nums">{Number(value).toLocaleString('it-IT')}</dd>
                  <dt className="kicker mt-1 text-xs text-muted">{label}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-muted">{m.sponsors.numbersNote}</p>
          </section>
        ) : null}
      </div>
    </>
  );
}
