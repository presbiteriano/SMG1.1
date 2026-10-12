import type { CompetitionDTO, EditionBundle, MatchDTO } from '@/lib/data/dto';

export type BracketRound = { stageId: number; name: string; kind: string; matches: MatchDTO[] };

/** I turni a eliminazione di una competizione, dal primo alla finale, con le partite nell'ordine del tabellone. */
export function bracketRounds(bundle: EditionBundle, competition: CompetitionDTO): BracketRound[] {
  return competition.stages
    .filter((stage) => stage.kind !== 'group')
    .map((stage) => ({
      stageId: stage.id,
      name: stage.name,
      kind: stage.kind,
      matches: bundle.matches.filter((match) => match.stageId === stage.id).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0) || a.id - b.id),
    }))
    .filter((round) => round.matches.length > 0);
}

/** Ordine per l'elenco: prima per orario, poi per identificativo; le partite senza orario in fondo. */
export function byKickoff(a: MatchDTO, b: MatchDTO): number {
  if (a.kickoffAt === b.kickoffAt) return a.id - b.id;
  if (a.kickoffAt === null) return 1;
  if (b.kickoffAt === null) return -1;
  return a.kickoffAt < b.kickoffAt ? -1 : 1;
}

/**
 * Scelta per MatchRail e home (brief 7.1): partita in corso, ultime partite finite, prossime.
 * Si ragiona sullo stato della partita, non sull'orologio: una rinviata resta tra le prossime.
 */
export function railMatches(matches: MatchDTO[], past = 3, future = 3): { items: MatchDTO[]; focusId: number | null } {
  const sorted = [...matches].sort(byKickoff);
  const live = sorted.filter((match) => match.status === 'live');
  const done = sorted.filter((match) => match.status === 'finished' || match.status === 'forfeited');
  const upcoming = sorted.filter((match) => match.status === 'scheduled' || match.status === 'postponed');
  const items = [...done.slice(-past), ...live, ...upcoming.slice(0, future)];
  const focus = live[0] ?? upcoming[0] ?? done.at(-1) ?? null;
  return { items, focusId: focus?.id ?? null };
}
