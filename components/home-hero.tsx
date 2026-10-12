import { CalendarPlus, Trophy } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { byKickoff } from '@/lib/bracket/view';
import type { EditionBundle, MatchDTO, SiteBundle, TeamRef } from '@/lib/data/dto';
import { dateKeyToInstant, formatRome, romeDateKey } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';
import { editionDates, registrationState } from '@/lib/site';
import { Countdown, type CountdownLabels } from './countdown';
import { hasScore, matchHref } from './match-card';
import { Skyline } from './skyline';
import { LiveDot, StatusBadge } from './status-badge';
import { TeamCrest } from './team-crest';
import { buttonClass, ButtonLink, Pill } from './ui';

// Hero della home: un solo blocco che cambia con lo stato dell'edizione (brief 5), invece di tre
// pagine da ricordarsi di sostituire.

function Shell({ kicker, children, live = false }: { kicker: ReactNode; children: ReactNode; live?: boolean }) {
  return (
    <section className="floodlit relative flex h-full flex-col overflow-hidden rounded-card">
      <div className="flex-1 px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Pill tone="ink">
            {live ? <LiveDot /> : null}
            {kicker}
          </Pill>
          <span className="kicker text-xs">{m.brand.claim}</span>
        </div>
        {children}
      </div>
      <Skyline className="mt-2" />
    </section>
  );
}

function countdownLabels(target: string): CountdownLabels {
  const c = m.home.countdown;
  return { label: c.label, target, days: c.days, hours: c.hours, minutes: c.minutes, seconds: c.seconds, done: c.done };
}

function TeamBig({ team, placeholder }: { team: TeamRef | null; placeholder: string | null }) {
  return (
    <div data-team={team?.slug} className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-xl p-2 text-center">
      {team ? <TeamCrest team={team} size={64} /> : <span aria-hidden className="size-16 rounded-full border-2 border-dashed border-ink/40" />}
      <span className="display text-3xl sm:text-4xl">{team?.code ?? '?'}</span>
      <span className="line-clamp-2 text-sm font-semibold">{team?.name ?? placeholder}</span>
    </div>
  );
}

/** Partita in primo piano durante il torneo: quella in corso, altrimenti la prossima, altrimenti l'ultima. */
function focusMatch(matches: MatchDTO[]): MatchDTO | null {
  const sorted = [...matches].sort(byKickoff);
  return (
    sorted.find((match) => match.status === 'live') ??
    sorted.find((match) => match.status === 'scheduled' && match.home && match.away) ??
    sorted.find((match) => match.status === 'scheduled') ??
    sorted.filter((match) => match.status === 'finished' || match.status === 'forfeited').at(-1) ??
    null
  );
}

function LiveHero({ bundle, now }: { bundle: EditionBundle; now: Date }) {
  const year = bundle.edition.year;
  const match = focusMatch(bundle.matches);
  if (!match) {
    return (
      <Shell kicker={m.status.edition.live}>
        <h1 className="text-5xl sm:text-7xl">{bundle.edition.name}</h1>
        <ButtonLink href={`/edizioni/${year}/calendario`} className="mt-6">
          {m.home.seeCalendar}
        </ButtonLink>
      </Shell>
    );
  }
  const today = match.kickoffAt !== null && romeDateKey(match.kickoffAt) === romeDateKey(now);
  const kicker = match.status === 'live' ? m.home.liveKicker : match.status === 'scheduled' ? (today ? m.home.todayKicker : m.home.nextKicker) : m.home.lastKicker;
  const scored = hasScore(match);
  return (
    <Shell kicker={kicker} live={match.status === 'live'}>
      <h1 className="text-2xl sm:text-3xl">
        {match.label}
        <span className="sr-only">
          : {match.home?.name ?? match.homePlaceholder} {m.match.vs} {match.away?.name ?? match.awayPlaceholder}
        </span>
      </h1>
      <p className="mt-1 text-sm font-semibold">
        {match.kickoffAt ? `${formatRome(match.kickoffAt, 'dayLong')}, ${formatRome(match.kickoffAt, 'time')}` : m.match.timeTbd}
        {match.fieldName ? ` · ${match.fieldName}` : ''}
      </p>
      <div className="mt-4 flex items-center gap-2 sm:gap-6">
        <TeamBig team={match.home} placeholder={match.homePlaceholder} />
        <div className="shrink-0 text-center" aria-hidden={!scored}>
          {scored ? (
            <p className="display flex items-center justify-center gap-2 text-7xl tabular-nums sm:text-8xl">
              {match.homeScore}
              <span className="h-1.5 w-4 rounded-full bg-ink" />
              {match.awayScore}
            </p>
          ) : (
            <p className="display text-6xl sm:text-7xl">{match.kickoffAt ? formatRome(match.kickoffAt, 'time') : 'VS'}</p>
          )}
          {match.homePens !== null && match.awayPens !== null ? <p className="kicker text-xs">{fmt(m.match.pensShort, { home: match.homePens, away: match.awayPens })}</p> : null}
          {match.status !== 'scheduled' && match.status !== 'live' ? <StatusBadge status={match.status} className="mt-2" /> : null}
        </div>
        <TeamBig team={match.away} placeholder={match.awayPlaceholder} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={matchHref(year, match.id)}>{m.match.details}</ButtonLink>
        <ButtonLink href={`/edizioni/${year}/calendario`} variant="outline">
          {m.home.seeCalendar}
        </ButtonLink>
        {match.status === 'scheduled' && match.kickoffAt ? (
          <a href={`/api/ics/partita/${match.id}`} className={buttonClass('ghost')}>
            <CalendarPlus aria-hidden className="size-5" />
            {m.home.addToCalendar}
          </a>
        ) : null}
      </div>
    </Shell>
  );
}

function FinishedHero({ bundle }: { bundle: EditionBundle }) {
  const year = bundle.edition.year;
  const podium = bundle.cup;
  return (
    <Shell kicker={m.home.finishedKicker}>
      <h1 className="text-5xl sm:text-7xl">{podium ? fmt(m.home.finishedTitle, { team: podium.winner.name }) : bundle.edition.name}</h1>
      <p className="mt-3 max-w-xl text-lg">{fmt(m.home.finishedText, { edition: bundle.edition.name })}</p>
      {podium ? (
        <ol aria-label={m.home.podium} className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            { team: podium.winner, label: m.home.podiumWinner, first: true },
            ...(podium.runnerUp ? [{ team: podium.runnerUp, label: m.home.podiumRunnerUp, first: false }] : []),
            ...podium.semifinalists.slice(0, 1).map((team) => ({ team, label: m.home.podiumSemi, first: false })),
          ].map(({ team, label, first }) => (
            <li key={`${label}-${team.entryId}`} data-team={team.slug} className={first ? 'flex items-center gap-3 rounded-xl bg-inverse p-3 text-on-inverse' : 'flex items-center gap-3 rounded-xl border-2 border-ink p-3'}>
              {first ? <Trophy aria-hidden className="size-7 shrink-0 text-accent" /> : <TeamCrest team={team} size={32} />}
              <span className="min-w-0">
                <span className="kicker block text-xs">{label}</span>
                <span className="display block truncate text-2xl">{team.name}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={`/edizioni/${year}`}>{m.home.finishedCta}</ButtonLink>
        <ButtonLink href={`/foto?edizione=${year}`} variant="outline">
          {m.nav.photos}
        </ButtonLink>
      </div>
    </Shell>
  );
}

function UpcomingHero({ bundle, site, now }: { bundle: EditionBundle; site: SiteBundle; now: Date }) {
  const { edition } = bundle;
  const year = edition.year;
  const firstKickoff = [...bundle.matches].sort(byKickoff).find((match) => match.kickoffAt)?.kickoffAt ?? null;
  const start = firstKickoff ?? (edition.startDate ? dateKeyToInstant(edition.startDate).toISOString() : null);
  const registration = registrationState(edition, now);
  const startsIn = start && Date.parse(start) > now.getTime();

  if (edition.status === 'registrations_open') {
    // Il conto alla rovescia punta alla scadenza più vicina che conta per chi legge: la chiusura delle iscrizioni.
    const close = registration === 'open' ? edition.registrationCloseAt : null;
    return (
      <Shell kicker={m.home.registrationKicker}>
        <h1 className="text-5xl sm:text-7xl">{m.home.registrationTitle}</h1>
        <p className="mt-3 max-w-xl text-lg">{m.home.registrationText}</p>
        <p className="mt-2 font-semibold">
          {edition.name} · {editionDates(edition)}
        </p>
        <div className="mt-5">
          {close ? <Countdown target={close} initialNow={now.toISOString()} labels={countdownLabels(m.home.countdown.toClose)} /> : null}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/iscrizioni">{m.home.registrationCta}</ButtonLink>
          <ButtonLink href={`/${year}`} variant="outline">
            {m.hub.rules}
          </ButtonLink>
        </div>
      </Shell>
    );
  }

  if (edition.status === 'scheduled') {
    return (
      <Shell kicker={m.home.scheduledKicker}>
        <h1 className="text-5xl sm:text-7xl">{start ? fmt(m.home.scheduledTitle, { date: formatRome(start, 'dayLong') }) : edition.name}</h1>
        <p className="mt-3 max-w-xl text-lg">{m.home.scheduledText}</p>
        <div className="mt-5">{startsIn && start ? <Countdown target={start} initialNow={now.toISOString()} labels={countdownLabels(m.home.countdown.toStart)} /> : null}</div>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={`/edizioni/${year}/calendario`}>{m.home.scheduledCta}</ButtonLink>
          <ButtonLink href={`/squadre?edizione=${year}`} variant="outline">
            {m.home.seeTeams}
          </ButtonLink>
        </div>
      </Shell>
    );
  }

  // Annunciata: niente tabelle vuote, ma conto alla rovescia e invito a seguire Instagram (brief 7.1).
  return (
    <Shell kicker={m.home.announcedKicker}>
      <h1 className="text-5xl sm:text-7xl">{fmt(m.home.announcedTitle, { name: edition.name })}</h1>
      <p className="mt-3 max-w-xl text-lg">{m.home.announcedText}</p>
      <div className="mt-5">
        {startsIn && start ? <Countdown target={start} initialNow={now.toISOString()} labels={countdownLabels(m.home.countdown.toStart)} /> : <p className="display text-4xl">{m.home.datesSoon}</p>}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={`/${year}`}>{edition.name}</ButtonLink>
        {site.settings.instagram_url ? (
          <a href={site.settings.instagram_url} rel="noopener" className={buttonClass('outline')}>
            {m.home.followInstagram}
          </a>
        ) : null}
      </div>
    </Shell>
  );
}

export function HomeHero({ bundle, site, now }: { bundle: EditionBundle | null; site: SiteBundle; now: Date }) {
  if (!bundle) {
    return (
      <Shell kicker={m.brand.place}>
        <h1 className="text-5xl sm:text-7xl">{m.home.emptyTitle}</h1>
        <p className="mt-3 max-w-xl text-lg">{m.home.emptyText}</p>
        {site.settings.instagram_url ? (
          <a href={site.settings.instagram_url} rel="noopener" className={buttonClass('primary', 'mt-6')}>
            {m.home.followInstagram}
          </a>
        ) : null}
      </Shell>
    );
  }
  switch (bundle.edition.status) {
    case 'live':
      return <LiveHero bundle={bundle} now={now} />;
    case 'finished':
      return <FinishedHero bundle={bundle} />;
    case 'announced':
    case 'registrations_open':
    case 'scheduled':
      return <UpcomingHero bundle={bundle} site={site} now={now} />;
    default:
      return (
        <Shell kicker={m.home.archiveKicker}>
          <h1 className="text-5xl sm:text-7xl">{m.home.archiveTitle}</h1>
          <p className="mt-3 max-w-xl text-lg">{m.home.archiveText}</p>
          <Link href="/edizioni" className={buttonClass('primary', 'mt-6')}>
            {m.home.archiveCta}
          </Link>
        </Shell>
      );
  }
}
