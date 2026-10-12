import type { Metadata } from 'next';
import { RegistrationForm } from '@/components/public-forms';
import { buttonClass, EmptyState, Kicker, PageHeader } from '@/components/ui';
import { getEdition, getSite } from '@/lib/data/queries';
import { formatRome } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';
import { editionDates, registrationState } from '@/lib/site';

export const metadata: Metadata = { title: m.registration.title, description: m.registration.question };

// Iscrizione squadra (brief 7.9): il modulo c'è solo quando le iscrizioni sono aperte.
export default async function RegistrationPage() {
  const { data: site } = await getSite();
  const bundle = site.featuredYear ? (await getEdition(site.featuredYear)).data : null;
  const edition = bundle?.edition ?? null;
  const state = edition ? registrationState(edition, new Date()) : 'closed';

  if (!edition || state !== 'open') {
    return (
      <>
        <PageHeader title={m.registration.closedTitle} />
        <div className="container-page pb-10">
          <EmptyState
            title={state === 'not_yet' && edition?.registrationOpenAt ? fmt(m.registration.notYetText, { date: formatRome(edition.registrationOpenAt, 'date') }) : m.registration.closedTitle}
            action={
              site.settings.instagram_url ? (
                <a href={site.settings.instagram_url} rel="noopener" className={buttonClass('primary')}>
                  {m.home.followInstagram}
                </a>
              ) : undefined
            }
          >
            <p>{m.registration.closedText}</p>
          </EmptyState>
        </div>
      </>
    );
  }

  const { registration } = edition.config;
  const taken = bundle?.teams.length ?? 0;

  return (
    <>
      <PageHeader kicker={edition.name} title={m.registration.title} question={m.registration.question} />
      <div className="container-page grid gap-10 pb-10 lg:grid-cols-[3fr_2fr]">
        <RegistrationForm labels={m.registration} optionalLabel={m.common.optional} />
        <aside className="space-y-4 lg:order-last">
          <div className="floodlit rounded-card p-5">
            <Kicker>{m.hub.when}</Kicker>
            <p className="display mt-1 text-2xl">{editionDates(edition)}</p>
            {edition.venue ? <p className="mt-1 font-semibold">{edition.venue.name}</p> : null}
            {edition.registrationCloseAt ? <p className="mt-3 text-sm font-semibold">{fmt(m.home.registrationCloses, { date: formatRome(edition.registrationCloseAt, 'date') })}</p> : null}
            {registration.capacity ? <p className="text-sm font-semibold">{fmt(m.hub.capacity, { taken, total: registration.capacity })}</p> : null}
          </div>
          <div className="card p-5">
            <Kicker className="text-muted">{m.registration.feeTitle}</Kicker>
            <p className="mt-1 text-lg font-semibold">{registration.fee_text || m.hub.feeUnknown}</p>
            {registration.payment_text ? <p className="mt-1 text-muted">{registration.payment_text}</p> : null}
          </div>
        </aside>
      </div>
    </>
  );
}
