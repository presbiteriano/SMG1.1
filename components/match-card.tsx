import Link from 'next/link';
import type { MatchDTO, TeamRef } from '@/lib/data/dto';
import { formatRome } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';
import { cx } from '@/lib/ui';
import { StatusBadge } from './status-badge';
import { TeamCrest } from './team-crest';

// MatchCard: giornata o fase, data, squadre con stemma o sigla, punteggio oppure orario, stato.

export function matchHref(year: number, matchId: number): string {
  return `/edizioni/${year}/partite/${matchId}`;
}

export function hasScore(match: MatchDTO): boolean {
  return match.homeScore !== null && match.awayScore !== null;
}

/** Descrizione completa per chi usa un lettore di schermo. */
export function matchSummary(match: MatchDTO): string {
  const home = match.home?.name ?? match.homePlaceholder ?? m.match.toBeDecided;
  const away = match.away?.name ?? match.awayPlaceholder ?? m.match.toBeDecided;
  const base = hasScore(match)
    ? fmt(m.match.scoreLabel, { home, away, homeScore: match.homeScore as number, awayScore: match.awayScore as number })
    : fmt(m.match.noScoreLabel, { home, away });
  return `${match.label}. ${base}. ${m.status[match.status]}.`;
}

function TeamLine({
  team,
  placeholder,
  score,
  pens,
  dimmed,
  showName,
  crestSize,
}: {
  team: TeamRef | null;
  placeholder: string | null;
  score: number | null;
  pens: number | null;
  dimmed: boolean;
  showName: boolean;
  crestSize: number;
}) {
  return (
    <div data-team={team?.slug} className={cx('flex items-center gap-2 rounded-md px-1 py-0.5', dimmed && 'text-muted')}>
      {team ? <TeamCrest team={team} size={crestSize} /> : <span aria-hidden className="size-6 shrink-0 rounded-full border border-dashed border-line" style={{ width: crestSize, height: crestSize }} />}
      <span className="min-w-0 flex-1 truncate">
        {team ? (
          showName ? (
            <span className="font-semibold">{team.name}</span>
          ) : (
            <span className="display text-xl">{team.code}</span>
          )
        ) : (
          <span className="text-sm text-muted">{placeholder}</span>
        )}
      </span>
      {score !== null ? (
        <span className="display text-3xl tabular-nums">
          {score}
          {pens !== null ? <span className="ml-1 align-middle text-base font-bold">({pens})</span> : null}
        </span>
      ) : null}
    </div>
  );
}

type CardProps = { match: MatchDTO; year: number; className?: string };

/** Scheda stretta per la striscia orizzontale sotto l'header (MatchRail). */
export function MatchTile({ match, year, className }: CardProps) {
  const scored = hasScore(match);
  return (
    <Link
      href={matchHref(year, match.id)}
      aria-label={matchSummary(match)}
      data-live={match.status === 'live' ? '' : undefined}
      className={cx('card flex w-44 shrink-0 snap-start flex-col gap-1.5 p-3 transition-colors hover:border-ink', match.status === 'live' && 'border-ink bg-surface-2', className)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="kicker truncate text-xs text-muted">{match.shortLabel}</span>
        {match.status === 'scheduled' && match.kickoffAt ? (
          <span className="display text-base">{formatRome(match.kickoffAt, 'time')}</span>
        ) : (
          <StatusBadge status={match.status} className="px-1.5 py-0.5 text-[0.6875rem]" />
        )}
      </div>
      <TeamLine team={match.home} placeholder={match.homePlaceholder} score={scored ? match.homeScore : null} pens={match.homePens} dimmed={match.winner === 'away'} showName={false} crestSize={24} />
      <TeamLine team={match.away} placeholder={match.awayPlaceholder} score={scored ? match.awayScore : null} pens={match.awayPens} dimmed={match.winner === 'home'} showName={false} crestSize={24} />
      <span className="text-xs text-muted">{match.kickoffAt ? formatRome(match.kickoffAt, 'dayShort') : m.match.timeTbd}</span>
    </Link>
  );
}

/** Scheda larga per gli elenchi: calendario, scheda squadra, hub dell'edizione. */
export function MatchCard({ match, year, className }: CardProps) {
  const scored = hasScore(match);
  return (
    <Link
      href={matchHref(year, match.id)}
      aria-label={matchSummary(match)}
      className={cx('card grid grid-cols-[4.25rem_1fr] items-center gap-3 p-3 transition-colors hover:border-ink sm:grid-cols-[5.5rem_1fr] sm:p-4', match.status === 'live' && 'border-ink', className)}
    >
      <div className="flex flex-col items-start gap-1 border-r border-line pr-2">
        <span className="display text-2xl">{match.kickoffAt ? formatRome(match.kickoffAt, 'time') : '--:--'}</span>
        <span className="text-xs text-muted">{match.fieldName ?? ''}</span>
      </div>
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="kicker truncate text-xs text-muted">{match.label}</span>
          <StatusBadge status={match.status} />
        </div>
        <TeamLine team={match.home} placeholder={match.homePlaceholder} score={scored ? match.homeScore : null} pens={match.homePens} dimmed={match.winner === 'away'} showName crestSize={28} />
        <TeamLine team={match.away} placeholder={match.awayPlaceholder} score={scored ? match.awayScore : null} pens={match.awayPens} dimmed={match.winner === 'home'} showName crestSize={28} />
        {match.note ? <p className="mt-1 px-1 text-sm text-muted">{match.note}</p> : null}
      </div>
    </Link>
  );
}
