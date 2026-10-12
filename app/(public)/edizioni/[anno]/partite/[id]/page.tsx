import { ArrowLeft, CalendarPlus, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShareResult } from '@/components/client-actions';
import { hasScore } from '@/components/match-card';
import { PhotoGrid } from '@/components/photo-grid';
import { DataFreshness } from '@/components/sections';
import { StatusBadge } from '@/components/status-badge';
import { TeamCrest } from '@/components/team-crest';
import { buttonClass, Kicker, SectionHeading } from '@/components/ui';
import type { EventDTO, MatchDTO, TeamRef } from '@/lib/data/dto';
import { requireEdition } from '@/lib/data/public';
import { getGallery } from '@/lib/data/queries';
import { formatRome } from '@/lib/datetime';
import { siteUrl } from '@/lib/env';
import { fmt, m } from '@/lib/i18n';
import { cx } from '@/lib/ui';

type Props = { params: Promise<{ anno: string; id: string }> };

async function load(props: Props) {
  const { anno, id } = await props.params;
  const snapshot = await requireEdition(anno);
  const match = /^\d{1,9}$/.test(id) ? snapshot.data.matches.find((item) => item.id === Number(id)) : undefined;
  if (!match) notFound();
  return { snapshot, match, bundle: snapshot.data };
}

const teamName = (team: TeamRef | null, placeholder: string | null) => team?.name ?? placeholder ?? m.match.toBeDecided;

function shareText(match: MatchDTO): string {
  const home = teamName(match.home, match.homePlaceholder);
  const away = teamName(match.away, match.awayPlaceholder);
  return hasScore(match)
    ? fmt(m.share.text, { home, away, homeScore: match.homeScore as number, awayScore: match.awayScore as number, brand: m.brand.name })
    : fmt(m.share.textNoScore, { home, away, brand: m.brand.name });
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { match, bundle } = await load(props);
  const title = hasScore(match)
    ? `${teamName(match.home, match.homePlaceholder)} ${match.homeScore} - ${match.awayScore} ${teamName(match.away, match.awayPlaceholder)}`
    : `${teamName(match.home, match.homePlaceholder)} - ${teamName(match.away, match.awayPlaceholder)}`;
  const description = `${match.label} · ${bundle.edition.name}${match.kickoffAt ? ` · ${formatRome(match.kickoffAt, 'dayFull')}, ${formatRome(match.kickoffAt, 'time')}` : ''}`;
  // L'anteprima social ha per chiave la versione della partita: a ogni cambio di punteggio è nuova.
  const image = `/api/share/${match.id}?formato=anteprima&v=${match.version}`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'article', images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

function BigTeam({ team, placeholder, align }: { team: TeamRef | null; placeholder: string | null; align: 'left' | 'right' }) {
  const body = (
    <>
      {team ? <TeamCrest team={team} size={72} /> : <span aria-hidden className="size-[72px] rounded-full border-2 border-dashed border-ink/40" />}
      <span className="display text-3xl sm:text-4xl">{team?.code ?? '?'}</span>
      <span className="text-sm font-semibold sm:text-base">{teamName(team, placeholder)}</span>
    </>
  );
  const className = cx('flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl p-2 text-center', align === 'left' ? 'sm:items-end sm:text-right' : 'sm:items-start sm:text-left');
  return team ? (
    <Link href={`/squadre/${team.slug}`} data-team={team.slug} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

// Cartellini: forma e testo, non colore (la palette del torneo non ha giallo e rosso).
function EventIcon({ type }: { type: EventDTO['type'] }) {
  if (type === 'yellow') return <span aria-hidden className="inline-block h-4 w-3 rounded-[2px] border-2 border-ink bg-surface" />;
  if (type === 'red') return <span aria-hidden className="inline-block h-4 w-3 rounded-[2px] bg-ink" />;
  if (type === 'mvp') return <Star aria-hidden className="size-4" fill="currentColor" />;
  return <span aria-hidden className="inline-block size-3.5 rounded-full border-2 border-ink bg-accent" />;
}

const EVENT_LABEL: Record<EventDTO['type'], string> = { goal: m.matchPage.goal, own_goal: m.matchPage.ownGoal, yellow: m.matchPage.yellow, red: m.matchPage.red, mvp: m.matchPage.mvp };

// Pagina partita (brief 7.6): resta bella anche con il solo punteggio.
export default async function MatchPage(props: Props) {
  const { snapshot, match, bundle } = await load(props);
  const { edition } = bundle;
  const scored = hasScore(match);
  const timeline = match.events.filter((event) => event.type !== 'mvp');
  const mvp = match.events.filter((event) => event.type === 'mvp');
  const photos = (await getGallery(edition.year)).data.filter((photo) => photo.matchId === match.id);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${teamName(match.home, match.homePlaceholder)} - ${teamName(match.away, match.awayPlaceholder)}`,
    description: `${match.label} · ${edition.name}`,
    sport: 'Soccer',
    startDate: match.kickoffAt ?? undefined,
    eventStatus: match.status === 'postponed' ? 'https://schema.org/EventPostponed' : match.status === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    url: `${siteUrl()}/edizioni/${edition.year}/partite/${match.id}`,
    location: edition.venue ? { '@type': 'Place', name: edition.venue.name, address: edition.venue.address ?? undefined } : undefined,
    homeTeam: match.home ? { '@type': 'SportsTeam', name: match.home.name } : undefined,
    awayTeam: match.away ? { '@type': 'SportsTeam', name: match.away.name } : undefined,
  };

  return (
    <div className="container-page space-y-8 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <Link href={`/edizioni/${edition.year}/calendario`} className="no-print inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-link underline">
        <ArrowLeft aria-hidden className="size-4" />
        {m.matchPage.back}
      </Link>

      <section className="floodlit rounded-card px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Kicker>{match.competitionName === match.label ? match.label : `${match.competitionName} · ${match.label}`}</Kicker>
          <StatusBadge status={match.status} long />
        </div>
        <h1 className="sr-only">
          {teamName(match.home, match.homePlaceholder)} {m.match.vs} {teamName(match.away, match.awayPlaceholder)}
        </h1>
        <div className="mt-5 flex items-center gap-2 sm:gap-8">
          <BigTeam team={match.home} placeholder={match.homePlaceholder} align="left" />
          <div className="shrink-0 text-center">
            {scored ? (
              <p className="display flex items-center justify-center gap-2 text-7xl tabular-nums sm:text-9xl" aria-label={fmt(m.match.scoreLabel, { home: teamName(match.home, null), away: teamName(match.away, null), homeScore: match.homeScore as number, awayScore: match.awayScore as number })}>
                <span aria-hidden>{match.homeScore}</span>
                <span aria-hidden className="h-1.5 w-4 rounded-full bg-ink sm:h-2 sm:w-6" />
                <span aria-hidden>{match.awayScore}</span>
              </p>
            ) : (
              <p className="display text-6xl sm:text-8xl">{match.kickoffAt ? formatRome(match.kickoffAt, 'time') : 'VS'}</p>
            )}
            {match.homePens !== null && match.awayPens !== null ? (
              <p className="kicker mt-1 text-sm">
                {m.match.afterPens}: {match.homePens}-{match.awayPens}
              </p>
            ) : null}
            {match.decidedBy === 'forfeit' ? <p className="kicker mt-1 text-sm">{m.match.forfeitNote}</p> : null}
          </div>
          <BigTeam team={match.away} placeholder={match.awayPlaceholder} align="right" />
        </div>
        <dl className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-1 text-sm font-semibold">
          <div className="flex gap-1.5">
            <dt className="sr-only">{m.match.kickoff}</dt>
            <dd>{match.kickoffAt ? `${formatRome(match.kickoffAt, 'dayFull')}, ${formatRome(match.kickoffAt, 'time')}` : m.match.timeTbd}</dd>
          </div>
          {match.fieldName ? (
            <div className="flex gap-1.5">
              <dt className="sr-only">{m.match.field}</dt>
              <dd>
                {match.fieldName}
                {edition.venue ? ` · ${edition.venue.name}` : ''}
              </dd>
            </div>
          ) : null}
        </dl>
        {match.note ? <p className="mt-3 text-center font-semibold">{match.note}</p> : null}
      </section>

      <div className="flex flex-wrap items-start gap-3">
        <ShareResult matchId={match.id} version={match.version} text={shareText(match)} labels={m.share} />
        {match.status === 'scheduled' && match.kickoffAt ? (
          <a href={`/api/ics/partita/${match.id}`} className={buttonClass('outline', 'no-print')}>
            <CalendarPlus aria-hidden className="size-5" />
            {m.home.addToCalendar}
          </a>
        ) : null}
      </div>

      <section aria-labelledby="cronaca">
        <SectionHeading id="cronaca" title={m.matchPage.events} />
        {timeline.length === 0 ? (
          <p className="text-muted">
            {match.status === 'scheduled' && match.kickoffAt
              ? fmt(m.matchPage.notPlayed, { date: formatRome(match.kickoffAt, 'dayLong'), time: formatRome(match.kickoffAt, 'time') })
              : match.status === 'postponed'
                ? m.matchPage.postponedText
                : match.status === 'cancelled'
                  ? m.matchPage.cancelledText
                  : m.matchPage.eventsEmpty}
          </p>
        ) : (
          <ol className="card divide-y divide-line">
            {timeline.map((event) => (
              <li key={event.id} className={cx('flex items-center gap-3 px-4 py-2.5', event.side === 'away' && 'flex-row-reverse text-right')}>
                <span className="display w-10 shrink-0 text-xl tabular-nums">{event.minute !== null ? fmt(m.matchPage.minute, { n: event.minute }) : ''}</span>
                <EventIcon type={event.type} />
                <span className="min-w-0">
                  <span className="block font-semibold">{event.playerName ?? m.matchPage.unknownScorer}</span>
                  <span className="kicker text-xs text-muted">
                    {EVENT_LABEL[event.type]} · {(event.side === 'home' ? match.home : match.away)?.code}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
        {mvp.map((event) => (
          <p key={event.id} className="mt-3 flex items-center gap-2 font-semibold">
            <Star aria-hidden className="size-5" fill="currentColor" />
            {m.matchPage.mvp}: {event.playerName} ({(event.side === 'home' ? match.home : match.away)?.code})
          </p>
        ))}
      </section>

      {photos.length > 0 ? (
        <section aria-labelledby="foto-partita">
          <SectionHeading id="foto-partita" title={m.matchPage.photos} />
          <PhotoGrid photos={photos} labels={m.gallery} />
        </section>
      ) : null}

      <DataFreshness generatedAt={snapshot.generatedAt} degraded={snapshot.degraded} />
    </div>
  );
}
