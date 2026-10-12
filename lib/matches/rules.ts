import type { DecidedBy, MatchStatus } from '@/db/schema/enums';
import { decidedBy } from '@/lib/standings/knockout';

// Regole di integrità di una partita (brief 11.2). Funzioni pure: le applica l'unico punto
// d'ingresso dei dati di gara (results-provider.ts), qualunque sia la provenienza.

export type MatchState = {
  status: MatchStatus;
  homeEntryId: number | null;
  awayEntryId: number | null;
  homeScore: number | null;
  awayScore: number | null;
  homePens: number | null;
  awayPens: number | null;
};

export type MatchRuleError =
  | 'scores_required'
  | 'pens_required'
  | 'same_team'
  | 'teams_required'
  | 'negative'
  | 'team_busy'
  | 'field_busy'
  | 'group_mismatch'
  | 'not_found';

export type MatchRuleContext = {
  /** Vero per le fasi a eliminazione diretta. */
  knockout: boolean;
};

/** Porta lo stato in forma coerente: niente punteggi per una partita non giocata, rigori solo dove servono. */
export function normalizeMatchState<T extends MatchState>(state: T, ctx: MatchRuleContext): T & { decidedBy: DecidedBy | null } {
  const next = { ...state };
  if (next.status === 'scheduled' || next.status === 'postponed' || next.status === 'cancelled') {
    next.homeScore = null;
    next.awayScore = null;
    next.homePens = null;
    next.awayPens = null;
  } else if (next.status === 'live') {
    next.homeScore = next.homeScore ?? 0;
    next.awayScore = next.awayScore ?? 0;
    next.homePens = null;
    next.awayPens = null;
  } else {
    const draw = next.homeScore !== null && next.homeScore === next.awayScore;
    if (next.status === 'forfeited' || !ctx.knockout || !draw) {
      next.homePens = null;
      next.awayPens = null;
    }
  }
  return { ...next, decidedBy: decidedBy(next) };
}

export function validateMatchState(state: MatchState, ctx: MatchRuleContext): MatchRuleError[] {
  const errors: MatchRuleError[] = [];
  const numbers = [state.homeScore, state.awayScore, state.homePens, state.awayPens];
  if (numbers.some((value) => value !== null && (!Number.isInteger(value) || value < 0))) errors.push('negative');

  if (state.homeEntryId !== null && state.homeEntryId === state.awayEntryId) errors.push('same_team');

  const played = state.status === 'live' || state.status === 'finished' || state.status === 'forfeited';
  if (played && (state.homeEntryId === null || state.awayEntryId === null)) errors.push('teams_required');

  if (state.status === 'finished' || state.status === 'forfeited') {
    if (state.homeScore === null || state.awayScore === null) {
      errors.push('scores_required');
    } else if (state.homeScore === state.awayScore) {
      // A tavolino serve un vincitore; nelle eliminazioni la parità si decide ai rigori.
      if (state.status === 'forfeited') errors.push('scores_required');
      else if (ctx.knockout && (state.homePens === null || state.awayPens === null || state.homePens === state.awayPens)) errors.push('pens_required');
    }
  }
  return errors;
}

export type ResultWarning = 'high_score' | 'late_edit';

const DAY = 24 * 60 * 60 * 1000;
export const HIGH_SCORE = 20;

/** Controlli anti-errore che non bloccano ma chiedono conferma (brief 9). */
export function resultWarnings(input: {
  before: { status: MatchStatus; homeScore: number | null; awayScore: number | null; updatedAt: Date } | null;
  next: { homeScore: number | null; awayScore: number | null };
  now: Date;
}): ResultWarning[] {
  const warnings: ResultWarning[] = [];
  if ((input.next.homeScore ?? 0) > HIGH_SCORE || (input.next.awayScore ?? 0) > HIGH_SCORE) warnings.push('high_score');
  const before = input.before;
  if (before && (before.status === 'finished' || before.status === 'forfeited')) {
    const changed = before.homeScore !== input.next.homeScore || before.awayScore !== input.next.awayScore;
    if (changed && input.now.getTime() - before.updatedAt.getTime() > DAY) warnings.push('late_edit');
  }
  return warnings;
}
