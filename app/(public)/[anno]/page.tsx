import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Countdown } from '@/components/countdown';
import { Skyline } from '@/components/skyline';
import { TeamCrest } from '@/components/team-crest';
import { ButtonLink, Kicker, Pill, SectionHeading } from '@/components/ui';
import { byKickoff } from '@/lib/bracket/view';
import { getEdition } from '@/lib/data/queries';
import { dateKeyToInstant, formatRome } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';
import { editionDates, isUpcoming, parseYear, registrationState } from '@/lib/site';

type Props = { params: Promise<{ anno: string }> };

async function load(props: Props) {
  const year = parseYear((await props.params).anno);
  if (!year) notFound();
  const { data } = await getEdition(year);
  if (!data) notFound();
  return data;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const bundle = await load(props);
  return { title: bundle.edition.name, description: `${bundle.edition.name}: ${editionDates(bundle.edition)}.` };
}

// Hub della prossima edizione (brief 7.9), all'indirizzo /2027: data e luogo, conto alla rovescia,
// regolamento, quota, squadre iscritte e, a tempo debito, calendario e gironi.
export default async function UpcomingEditionPage(props: Props) {
  const bundle = await load(props);
  const { edition } = bundle;
  // A torneo iniziato o concluso questa pagina lascia il posto all'hub con risultati e classifiche.
  if (!isUpcoming(edition.status)) redirect(`/edizioni/${edition.year}`);

  const now = new Date();
  const config = edition.config;
  const registration = registrationState(edition, now);
  const firstKickoff = [...bundle.matches].sort(byKickoff).find((match) => match.kickoffAt)?.kickoffAt ?? null;
  const start = firstKickoff ?? (edition.startDate ? dateKeyToInstant(edition.startDate).toISOString() : null);
  const countdownTarget = registration === 'open' && edition.registrationCloseAt ? edition.registrationCloseAt : start && Date.parse(start) > now.getTime() ? start : null;
  const c = m.home.countdown;

  return (
    <>
      <div className="container-page pt-6">
        <section className="floodlit overflow-hidden rounded-card">
          <div className="px-5 pt-7 sm:px-8 sm:pt-10">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Pill tone="ink">{m.status.edition[edition.status]}</Pill>
              <span className="kicker text-xs">{m.brand.claim}</span>
            </div>
            <Kicker>{m.hub.kicker}</Kicker>
            <h1 className="mt-1 text-6xl sm:text-8xl">{edition.name}</h1>
            <p className="mt-3 text-xl font-semibold">
              {editionDates(edition)}
              {edition.venue ? ` · ${edition.venue.name}` : ''}
            </p>
            {countdownTarget ? (
              <div className="mt-6">
                <Countdown
                  target={countdownTarget}
                  initialNow={now.toISOString()}
                  labels={{ label: c.label, target: registration === 'open' ? c.toClose : c.toStart, days: c.days, hours: c.hours, minutes: c.minutes, seconds: c.seconds, done: c.done }}
                />
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              {registration === 'open' ? <ButtonLink href="/iscrizioni">{m.hub.register}</ButtonLink> : null}
              {bundle.matches.length > 0 ? (
                <ButtonLink href={`/edizioni/${edition.year}/calendario`} variant={registration === 'open' ? 'outline' : 'primary'}>
                  {m.home.scheduledCta}
                </ButtonLink>
              ) : null}
              <ButtonLink href="/regolamento" variant="outline">
                {m.hub.rules}
              </ButtonLink>
            </div>
          </div>
          <Skyline className="mt-6" />
        </section>
      </div>

      <div className="container-page mt-10 grid gap-10 pb-10 lg:grid-cols-2">
        <section aria-labelledby="scheda">
          <SectionHeading id="scheda" title={m.nav.info} />
          <dl className="card divide-y divide-line">
            <div className="p-4">
              <dt className="kicker text-xs text-muted">{m.hub.when}</dt>
              <dd className="mt-1 text-lg font-semibold">{editionDates(edition)}</dd>
            </div>
            {edition.venue ? (
              <div className="p-4">
                <dt className="kicker text-xs text-muted">{m.hub.where}</dt>
                <dd className="mt-1 text-lg font-semibold">
                  {edition.venue.name}
                  {edition.venue.address ? <span className="block text-base font-normal text-muted">{edition.venue.address}</span> : null}
                </dd>
              </div>
            ) : null}
            <div className="p-4">
              <dt className="kicker text-xs text-muted">{m.hub.format}</dt>
              <dd className="mt-1">
                {fmt(m.hub.formatText, { groups: config.groups, qualify: config.qualify_per_group })}
                {config.format.players_on_field ? ` ${fmt(m.hub.formatOnField, { n: config.format.players_on_field })}` : ''}
                {config.format.halves && config.format.half_minutes ? ` ${fmt(m.hub.formatTime, { halves: config.format.halves, minutes: config.format.half_minutes })}` : ''}
              </dd>
            </div>
            <div className="p-4">
              <dt className="kicker text-xs text-muted">{m.hub.fee}</dt>
              <dd className="mt-1">
                <span className="text-lg font-semibold">{config.registration.fee_text || m.hub.feeUnknown}</span>
                {config.registration.payment_text ? <span className="block text-muted">{config.registration.payment_text}</span> : null}
              </dd>
            </div>
          </dl>
          {registration !== 'open' ? (
            <p className="mt-3 text-muted">
              {registration === 'not_yet' && edition.registrationOpenAt ? fmt(m.registration.notYetText, { date: formatRome(edition.registrationOpenAt, 'date') }) : m.hub.registrationClosed}
            </p>
          ) : null}
        </section>

        <section aria-labelledby="iscritte">
          <SectionHeading id="iscritte" title={m.hub.registered} />
          {bundle.teams.length === 0 ? (
            <p className="text-muted">{m.hub.registeredEmpty}</p>
          ) : (
            <>
              <p className="mb-3 font-semibold">
                {config.registration.capacity ? fmt(m.hub.capacity, { taken: bundle.teams.length, total: config.registration.capacity }) : fmt(m.hub.registeredCount, { n: bundle.teams.length })}
              </p>
              <ul className="grid grid-cols-2 gap-2">
                {bundle.teams.map((team) => (
                  <li key={team.entryId}>
                    <Link href={`/squadre/${team.slug}`} data-team={team.slug} className="card flex min-h-12 items-center gap-2 p-2 shadow-none hover:border-ink">
                      <TeamCrest team={team} size={32} />
                      <span className="min-w-0 truncate text-sm font-semibold">{team.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {bundle.matches.length === 0 ? <p className="mt-4 text-muted">{m.hub.calendarSoon}</p> : null}
        </section>
      </div>
    </>
  );
}
