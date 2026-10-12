import type { DecidedBy, MatchStatus } from '@/db/schema/enums';

export type DecidableMatch = {
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  homePens: number | null;
  awayPens: number | null;
};

export type Side = 'home' | 'away';

/**
 * Chi ha vinto una partita conclusa. Nelle eliminazioni, in caso di parità decidono i rigori:
 * i rigori dicono chi passa ma non entrano in gol fatti e subiti (T5).
 */
export function matchWinner(match: DecidableMatch): Side | null {
  if (match.status !== 'finished' && match.status !== 'forfeited') return null;
  if (match.homeScore === null || match.awayScore === null) return null;
  if (match.homeScore !== match.awayScore) return match.homeScore > match.awayScore ? 'home' : 'away';
  if (match.homePens === null || match.awayPens === null || match.homePens === match.awayPens) return null;
  return match.homePens > match.awayPens ? 'home' : 'away';
}

export function matchLoser(match: DecidableMatch): Side | null {
  const winner = matchWinner(match);
  return winner === null ? null : winner === 'home' ? 'away' : 'home';
}

export function decidedBy(match: DecidableMatch): DecidedBy | null {
  if (match.status === 'forfeited') return 'forfeit';
  if (match.status !== 'finished') return null;
  return match.homePens !== null && match.awayPens !== null ? 'penalties' : 'regulation';
}
