import { Trophy } from 'lucide-react';
import Link from 'next/link';
import type { BracketRound } from '@/lib/bracket/view';
import type { MatchDTO, TeamRef } from '@/lib/data/dto';
import { formatRome } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';
import { cx } from '@/lib/ui';
import { hasScore, matchHref, matchSummary } from './match-card';
import { StatusBadge } from './status-badge';
import { TeamCrest } from './team-crest';

// Bracket: tabellone a eliminazione derivato dalle partite e dai collegamenti tra fasi (brief 7.4).
// Su telefono un turno per volta con scorrimento orizzontale a scatto; su desktop l'albero completo.

function Side({ team, placeholder, score, pens, lost }: { team: TeamRef | null; placeholder: string | null; score: number | null; pens: number | null; lost: boolean }) {
  return (
    <div data-team={team?.slug} className={cx('flex min-h-10 items-center gap-2 rounded-md px-2', lost && 'text-muted')}>
      {team ? <TeamCrest team={team} size={26} /> : <span aria-hidden className="size-[26px] shrink-0 rounded-full border border-dashed border-line" />}
      <span className="min-w-0 flex-1 truncate">{team ? <span className="font-semibold">{team.name}</span> : <span className="text-sm text-muted">{placeholder}</span>}</span>
      {score !== null ? (
        <span className="display text-2xl">
          {score}
          {pens !== null ? <span className="ml-1 text-sm font-bold">({pens})</span> : null}
        </span>
      ) : null}
    </div>
  );
}

function BracketMatch({ match, year, big }: { match: MatchDTO; year: number; big: boolean }) {
  const scored = hasScore(match);
  return (
    <Link
      href={matchHref(year, match.id)}
      aria-label={matchSummary(match)}
      className={cx('card block p-2 transition-colors hover:border-ink', big && 'border-2 border-ink p-3', match.status === 'live' && 'bg-surface-2')}
    >
      <div className="mb-1 flex items-center justify-between gap-2 px-2">
        <span className="kicker text-xs text-muted">{match.label}</span>
        {match.status === 'scheduled' ? (
          <span className="text-xs text-muted">{match.kickoffAt ? formatRome(match.kickoffAt, 'dateTime') : m.match.timeTbd}</span>
        ) : (
          <StatusBadge status={match.status} className="px-1.5 py-0.5" />
        )}
      </div>
      <Side team={match.home} placeholder={match.homePlaceholder} score={scored ? match.homeScore : null} pens={match.homePens} lost={match.winner === 'away'} />
      <Side team={match.away} placeholder={match.awayPlaceholder} score={scored ? match.awayScore : null} pens={match.awayPens} lost={match.winner === 'home'} />
      {match.decidedBy === 'penalties' ? <p className="mt-1 px-2 text-xs text-muted">{m.match.afterPens}</p> : null}
    </Link>
  );
}

export function Bracket({ rounds, year, competitionName, champion }: { rounds: BracketRound[]; year: number; competitionName: string; champion: TeamRef | null }) {
  return (
    <div>
      <div className="rail gap-4 pb-3 md:grid md:auto-cols-fr md:grid-flow-col md:overflow-visible" role="list" aria-label={competitionName}>
        {rounds.map((round, index) => {
          const last = index === rounds.length - 1;
          return (
            <section key={round.stageId} role="listitem" aria-labelledby={`round-${round.stageId}`} className="flex w-[84vw] max-w-sm shrink-0 snap-center flex-col md:w-auto md:max-w-none">
              <h3 id={`round-${round.stageId}`} className="mb-3 border-b-2 border-ink pb-1.5 text-xl">
                {round.name}
              </h3>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {round.matches.map((match) => (
                  <BracketMatch key={match.id} match={match} year={year} big={last && round.matches.length === 1} />
                ))}
                {last && champion ? (
                  <div data-team={champion.slug} className="floodlit flex items-center gap-3 rounded-card p-4">
                    <Trophy aria-hidden className="size-8 shrink-0" strokeWidth={2.2} />
                    <div className="min-w-0">
                      <p className="kicker text-xs">{fmt(m.bracket.championOf, { competition: competitionName })}</p>
                      <p className="display truncate text-3xl">{champion.name}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
      {rounds.length > 1 ? <p className="text-sm text-muted md:hidden">{m.bracket.scrollHint}</p> : null}
    </div>
  );
}
