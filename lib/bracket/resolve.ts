import type { MatchStatus, SlotSource } from '@/db/schema/enums';
import { matchLoser, matchWinner } from '@/lib/standings/knockout';

// Il tabellone si deriva dalle partite e dai collegamenti tra fasi (brief 7.4): quando un girone
// si chiude o una partita a eliminazione finisce, le caselle successive si riempiono da sole.

export type SlotMatch = {
  id: number;
  status: MatchStatus;
  homeEntryId: number | null;
  awayEntryId: number | null;
  homeSource: SlotSource | null;
  awaySource: SlotSource | null;
  homeScore: number | null;
  awayScore: number | null;
  homePens: number | null;
  awayPens: number | null;
};

export type SlotUpdate = { matchId: number; homeEntryId: number | null; awayEntryId: number | null };

/** Squadra che occupa una posizione di un girone, oppure null se non è ancora decisa. */
export type RankLookup = (groupId: number, rank: number) => number | null;

export function resolveSlots(matches: SlotMatch[], rankOf: RankLookup): SlotUpdate[] {
  const state = new Map(matches.map((match) => [match.id, { ...match }]));
  const updates = new Map<number, SlotUpdate>();

  const resolve = (source: SlotSource): number | null => {
    if (source.kind === 'group_rank') return rankOf(source.groupId, source.rank);
    const from = state.get(source.matchId);
    if (!from) return null;
    const side = source.kind === 'match_winner' ? matchWinner(from) : matchLoser(from);
    return side === null ? null : side === 'home' ? from.homeEntryId : from.awayEntryId;
  };

  // Più passaggi: un quarto deciso può sbloccare una semifinale, che può sbloccare la finale.
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    for (const match of state.values()) {
      // Una partita già iniziata o conclusa non cambia squadre da sola: serve una correzione a mano.
      if (match.status === 'live' || match.status === 'finished' || match.status === 'forfeited') continue;
      const home = match.homeSource ? resolve(match.homeSource) : match.homeEntryId;
      const away = match.awaySource ? resolve(match.awaySource) : match.awayEntryId;
      if (home === match.homeEntryId && away === match.awayEntryId) continue;
      match.homeEntryId = home;
      match.awayEntryId = away;
      updates.set(match.id, { matchId: match.id, homeEntryId: home, awayEntryId: away });
      changed = true;
    }
    if (!changed) break;
  }
  return [...updates.values()];
}
