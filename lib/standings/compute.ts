import type { MatchStatus } from '@/db/schema/enums';
import type { EditionConfig, Tiebreaker } from '@/lib/config/edition-config';

// Calcolo della classifica (brief 11.3). La classifica non si salva mai: si ricava dalle partite.
// Funzioni pure, senza database: così i casi di spareggio si provano con i test.

export type StandingsMatch<K> = {
  homeId: K | null;
  awayId: K | null;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  /** Cartellini per il criterio fair play (facoltativi). */
  discipline?: { home: { yellow: number; red: number }; away: { yellow: number; red: number } };
};

export type StandingsRow<K> = {
  teamId: K;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  fairPlay: number;
  /** Vero se nessun criterio ha separato questa squadra da un'altra: serve il sorteggio. */
  tied: boolean;
};

export type TiebreakNote<K> = {
  /** Criterio che ha separato squadre a pari punti. */
  criterion: Exclude<Tiebreaker, 'points'>;
  /** Le squadre che erano pari, nell'ordine finale. */
  teamIds: K[];
};

export type StandingsResult<K> = {
  rows: StandingsRow<K>[];
  /** Vero finché nel girone restano partite da giocare. */
  provisional: boolean;
  notes: TiebreakNote<K>[];
};

export type StandingsRules = Pick<EditionConfig, 'points' | 'tiebreakers' | 'fair_play'>;

type Tally = Omit<StandingsRow<unknown>, 'teamId' | 'position' | 'tied'>;

const emptyTally = (): Tally => ({
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDiff: 0,
  points: 0,
  fairPlay: 0,
});

/** Una partita entra in classifica solo se è conclusa (sul campo o a tavolino) e ha entrambi i punteggi. */
export function countsForStandings<K>(match: StandingsMatch<K>): boolean {
  return (
    (match.status === 'finished' || match.status === 'forfeited') &&
    match.homeScore !== null &&
    match.awayScore !== null &&
    match.homeId !== null &&
    match.awayId !== null
  );
}

/** Una partita ancora da giocare rende la classifica provvisoria. Le annullate non contano. */
function isPending<K>(match: StandingsMatch<K>): boolean {
  return match.status === 'scheduled' || match.status === 'live' || match.status === 'postponed';
}

function tally<K>(teamIds: K[], matches: StandingsMatch<K>[], rules: StandingsRules): Map<K, Tally> {
  const table = new Map<K, Tally>(teamIds.map((teamId) => [teamId, emptyTally()]));
  for (const match of matches) {
    if (!countsForStandings(match)) continue;
    const home = table.get(match.homeId as K);
    const away = table.get(match.awayId as K);
    if (!home || !away) continue; // partita con una squadra estranea al sottogruppo
    const hs = match.homeScore as number;
    const as = match.awayScore as number;
    home.played += 1;
    away.played += 1;
    home.goalsFor += hs;
    home.goalsAgainst += as;
    away.goalsFor += as;
    away.goalsAgainst += hs;
    if (hs > as) {
      home.won += 1;
      away.lost += 1;
      home.points += rules.points.win;
      away.points += rules.points.loss;
    } else if (hs < as) {
      away.won += 1;
      home.lost += 1;
      away.points += rules.points.win;
      home.points += rules.points.loss;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += rules.points.draw;
      away.points += rules.points.draw;
    }
    if (match.discipline) {
      home.fairPlay += match.discipline.home.yellow * rules.fair_play.yellow + match.discipline.home.red * rules.fair_play.red;
      away.fairPlay += match.discipline.away.yellow * rules.fair_play.yellow + match.discipline.away.red * rules.fair_play.red;
    }
  }
  for (const row of table.values()) row.goalDiff = row.goalsFor - row.goalsAgainst;
  return table;
}

type Context<K> = {
  matches: StandingsMatch<K>[];
  rules: StandingsRules;
  overall: Map<K, Tally>;
  lotOrder: K[] | null;
  notes: TiebreakNote<K>[];
};

/** Valore del criterio per ogni squadra del sottogruppo: più alto è meglio. null = criterio non applicabile. */
function valuesFor<K>(criterion: Tiebreaker, ids: K[], ctx: Context<K>): Map<K, number> | null {
  const pick = (source: Map<K, Tally>, read: (t: Tally) => number) =>
    new Map(ids.map((teamId) => [teamId, read(source.get(teamId) ?? emptyTally())]));

  switch (criterion) {
    case 'points':
      return pick(ctx.overall, (t) => t.points);
    case 'goal_diff':
      return pick(ctx.overall, (t) => t.goalDiff);
    case 'goals_for':
      return pick(ctx.overall, (t) => t.goalsFor);
    case 'fair_play':
      return pick(ctx.overall, (t) => -t.fairPlay); // meno punti di disciplina è meglio
    case 'head_to_head_points':
    case 'head_to_head_goal_diff': {
      // Solo le partite tra le squadre ancora pari.
      const inGroup = new Set(ids);
      const direct = ctx.matches.filter((match) => inGroup.has(match.homeId as K) && inGroup.has(match.awayId as K));
      const mini = tally(ids, direct, ctx.rules);
      return pick(mini, (t) => (criterion === 'head_to_head_points' ? t.points : t.goalDiff));
    }
    case 'draw_lot': {
      const order = ctx.lotOrder;
      if (!order || !ids.every((teamId) => order.includes(teamId))) return null;
      return new Map(ids.map((teamId) => [teamId, -order.indexOf(teamId)]));
    }
  }
}

/**
 * Ordina per il primo criterio; ai pari merito applica il criterio successivo solo nel sottogruppo
 * ancora pari; ripete finché il sottogruppo si riduce (brief 11.3).
 * Restituisce blocchi ordinati: un blocco con più squadre è un pari merito non risolto.
 */
function rank<K>(ids: K[], index: number, ctx: Context<K>): K[][] {
  if (ids.length <= 1 || index >= ctx.rules.tiebreakers.length) return [ids];
  const criterion = ctx.rules.tiebreakers[index];
  const values = valuesFor(criterion, ids, ctx);
  if (!values) return rank(ids, index + 1, ctx);

  const buckets = new Map<number, K[]>();
  for (const teamId of ids) {
    const value = values.get(teamId) ?? 0;
    buckets.set(value, [...(buckets.get(value) ?? []), teamId]);
  }
  if (buckets.size === 1) return rank(ids, index + 1, ctx);

  const ordered = [...buckets.entries()].sort((a, b) => b[0] - a[0]).map(([, bucket]) => bucket);
  const blocks = ordered.flatMap((bucket) => rank(bucket, index + 1, ctx));
  if (criterion !== 'points') ctx.notes.push({ criterion, teamIds: blocks.flat() });
  return blocks;
}

export function computeStandings<K>(input: {
  teamIds: K[];
  matches: StandingsMatch<K>[];
  rules: StandingsRules;
  /** Ordine deciso dal sorteggio, se registrato. */
  lotOrder?: K[] | null;
}): StandingsResult<K> {
  const { teamIds, matches, rules } = input;
  const overall = tally(teamIds, matches, rules);
  const ctx: Context<K> = { matches, rules, overall, lotOrder: input.lotOrder ?? null, notes: [] };
  const blocks = rank(teamIds, 0, ctx);

  const rows: StandingsRow<K>[] = [];
  for (const block of blocks) {
    const position = rows.length + 1;
    for (const teamId of block) {
      rows.push({ teamId, position, tied: block.length > 1, ...(overall.get(teamId) ?? emptyTally()) });
    }
  }

  const inGroup = new Set(teamIds);
  const provisional = matches.some(
    (match) => isPending(match) && (match.homeId === null || match.awayId === null || inGroup.has(match.homeId) || inGroup.has(match.awayId)),
  );

  // Le note più specifiche (sottogruppi piccoli) vengono registrate per prime: le riportiamo dall'alto.
  return { rows, provisional, notes: ctx.notes.reverse() };
}
