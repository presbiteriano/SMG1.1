import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import {
  competitions,
  editions,
  fields,
  groups,
  matchEvents,
  matches,
  media,
  people,
  rosterEntries,
  stages,
  teamEntries,
  teams,
  tiebreakDecisions,
  venues,
} from '@/db/schema';
import type { EditionConfig } from '@/lib/config/edition-config';
import { computeStandings, type StandingsMatch, type StandingsResult } from '@/lib/standings/compute';
import type { Db } from './db';

// Lettura grezza di un'edizione: righe del database così come sono. La usano sia la vista pubblica
// (edition-bundle.ts) sia l'avanzamento del tabellone dopo ogni risultato (results-provider.ts).

export type EditionRow = typeof editions.$inferSelect;
export type MatchRow = typeof matches.$inferSelect;
export type MatchEventRow = typeof matchEvents.$inferSelect;
export type TeamRow = typeof teams.$inferSelect;
export type TeamEntryRow = typeof teamEntries.$inferSelect;
export type PersonRow = typeof people.$inferSelect;
export type RosterEntryRow = typeof rosterEntries.$inferSelect;
export type MediaRow = typeof media.$inferSelect;

export type EditionRaw = {
  edition: EditionRow;
  venue: typeof venues.$inferSelect | null;
  competitions: (typeof competitions.$inferSelect)[];
  stages: (typeof stages.$inferSelect)[];
  groups: (typeof groups.$inferSelect)[];
  entries: { entry: TeamEntryRow; team: TeamRow; crest: MediaRow | null }[];
  matches: MatchRow[];
  events: { event: MatchEventRow; roster: RosterEntryRow | null; person: PersonRow | null }[];
  rosters: { roster: RosterEntryRow; person: PersonRow }[];
  fields: (typeof fields.$inferSelect)[];
  lots: (typeof tiebreakDecisions.$inferSelect)[];
};

export async function fetchEditionRaw(db: Db, editionId: number): Promise<EditionRaw | null> {
  const [edition] = await db.select().from(editions).where(eq(editions.id, editionId)).limit(1);
  if (!edition) return null;

  const [venue] = edition.venueId ? await db.select().from(venues).where(eq(venues.id, edition.venueId)).limit(1) : [];

  const competitionRows = await db
    .select()
    .from(competitions)
    .where(eq(competitions.editionId, editionId))
    .orderBy(asc(competitions.order), asc(competitions.id));
  const competitionIds = competitionRows.map((row) => row.id);

  const stageRows = competitionIds.length
    ? await db.select().from(stages).where(inArray(stages.competitionId, competitionIds)).orderBy(asc(stages.order), asc(stages.id))
    : [];
  const stageIds = stageRows.map((row) => row.id);

  const groupRows = stageIds.length
    ? await db.select().from(groups).where(inArray(groups.stageId, stageIds)).orderBy(asc(groups.order), asc(groups.id))
    : [];
  const groupIds = groupRows.map((row) => row.id);

  const entryRows = await db
    .select({ entry: teamEntries, team: teams, crest: media })
    .from(teamEntries)
    .innerJoin(teams, eq(teams.id, teamEntries.teamId))
    .leftJoin(media, eq(media.id, teams.crestMediaId))
    .where(eq(teamEntries.editionId, editionId))
    .orderBy(asc(teams.name));
  const entryIds = entryRows.map((row) => row.entry.id);

  const matchRows = await db
    .select()
    .from(matches)
    .where(and(eq(matches.editionId, editionId), isNull(matches.archivedAt)))
    .orderBy(asc(matches.kickoffAt), asc(matches.id));
  const matchIds = matchRows.map((row) => row.id);

  const eventRows = matchIds.length
    ? await db
        .select({ event: matchEvents, roster: rosterEntries, person: people })
        .from(matchEvents)
        .leftJoin(rosterEntries, eq(rosterEntries.id, matchEvents.rosterEntryId))
        .leftJoin(people, eq(people.id, rosterEntries.personId))
        .where(inArray(matchEvents.matchId, matchIds))
        .orderBy(asc(matchEvents.minute), asc(matchEvents.id))
    : [];

  const rosterRows = entryIds.length
    ? await db
        .select({ roster: rosterEntries, person: people })
        .from(rosterEntries)
        .innerJoin(people, eq(people.id, rosterEntries.personId))
        .where(inArray(rosterEntries.teamEntryId, entryIds))
        .orderBy(asc(rosterEntries.shirtNumber), asc(rosterEntries.id))
    : [];

  const fieldRows = await db.select().from(fields);
  const lotRows = groupIds.length ? await db.select().from(tiebreakDecisions).where(inArray(tiebreakDecisions.groupId, groupIds)) : [];

  return {
    edition,
    venue: venue ?? null,
    competitions: competitionRows,
    stages: stageRows,
    groups: groupRows,
    entries: entryRows,
    matches: matchRows,
    events: eventRows,
    rosters: rosterRows,
    fields: fieldRows,
    lots: lotRows,
  };
}

export type GroupTable = {
  groupId: number;
  result: StandingsResult<number>;
  /** Vero se tutte le partite del girone sono concluse e almeno una è stata giocata. */
  complete: boolean;
};

/** Classifiche di tutti i gironi dell'edizione, calcolate dalle partite (mai salvate). */
export function buildGroupTables(raw: EditionRaw, config: EditionConfig): Map<number, GroupTable> {
  const cards = new Map<number, Map<number, { yellow: number; red: number }>>();
  for (const { event } of raw.events) {
    if (event.type !== 'yellow' && event.type !== 'red') continue;
    const perMatch = cards.get(event.matchId) ?? new Map<number, { yellow: number; red: number }>();
    const tally = perMatch.get(event.teamEntryId) ?? { yellow: 0, red: 0 };
    tally[event.type] += 1;
    perMatch.set(event.teamEntryId, tally);
    cards.set(event.matchId, perMatch);
  }

  const tables = new Map<number, GroupTable>();
  for (const group of raw.groups) {
    const teamIds = raw.entries.filter((row) => row.entry.groupId === group.id && row.entry.status !== 'withdrawn').map((row) => row.entry.id);
    const groupMatches = raw.matches.filter((match) => match.groupId === group.id);
    const standingsMatches: StandingsMatch<number>[] = groupMatches.map((match) => {
      const perMatch = cards.get(match.id);
      const none = { yellow: 0, red: 0 };
      return {
        homeId: match.homeEntryId,
        awayId: match.awayEntryId,
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        discipline: {
          home: (match.homeEntryId !== null && perMatch?.get(match.homeEntryId)) || none,
          away: (match.awayEntryId !== null && perMatch?.get(match.awayEntryId)) || none,
        },
      };
    });
    const lot = raw.lots.find((row) => row.groupId === group.id);
    const result = computeStandings({ teamIds, matches: standingsMatches, rules: config, lotOrder: lot?.entryOrder ?? null });
    const played = standingsMatches.some((match) => match.status === 'finished' || match.status === 'forfeited');
    tables.set(group.id, { groupId: group.id, result, complete: played && !result.provisional });
  }
  return tables;
}
