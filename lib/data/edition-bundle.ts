import { eq } from 'drizzle-orm';
import { editions } from '@/db/schema';
import type { SlotSource } from '@/db/schema/enums';
import { safeEditionConfig } from '@/lib/config/edition-config';
import { fmt, m } from '@/lib/i18n';
import { isMediaPublic } from '@/lib/media/visibility';
import { publicPersonName } from '@/lib/people/display-name';
import { decidedBy, matchWinner } from '@/lib/standings/knockout';
import type { Db } from './db';
import type {
  CompetitionDTO,
  EditionBundle,
  EditionTeamDTO,
  EventDTO,
  GroupDTO,
  MatchDTO,
  PodiumDTO,
  ScorerDTO,
  StatsDTO,
  TeamRef,
  TeamStatDTO,
} from './dto';
import { buildGroupTables, fetchEditionRaw, type EditionRaw, type MatchRow } from './edition-raw';

// Vista pubblica di un'edizione: partite, classifiche calcolate, tabellone e statistiche.
// I nomi delle persone passano tutti da publicPersonName: qui dentro non restano dati grezzi.

const hiddenLabels = { withNumber: m.people.hiddenWithNumber, withoutNumber: m.people.hidden };

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

function isKnockout(kind: string): boolean {
  return kind !== 'group';
}

export function buildEditionBundle(raw: EditionRaw): EditionBundle {
  const config = safeEditionConfig(raw.edition.config);
  const tables = buildGroupTables(raw, config);

  const competitionById = new Map(raw.competitions.map((row) => [row.id, row]));
  const stageById = new Map(raw.stages.map((row) => [row.id, row]));
  const groupById = new Map(raw.groups.map((row) => [row.id, row]));
  const fieldById = new Map(raw.fields.map((row) => [row.id, row]));
  const matchById = new Map(raw.matches.map((row) => [row.id, row]));

  const teamByEntry = new Map<number, TeamRef>();
  for (const { entry, team, crest } of raw.entries) {
    teamByEntry.set(entry.id, {
      entryId: entry.id,
      teamId: team.id,
      slug: team.slug,
      name: team.name,
      code: team.shortCode,
      kitColor: team.kitColor,
      crestId: crest && isMediaPublic(crest) ? crest.id : null,
    });
  }

  function labelsFor(match: MatchRow): { label: string; shortLabel: string } {
    const stage = stageById.get(match.stageId);
    const competition = competitionById.get(match.competitionId);
    const group = match.groupId ? groupById.get(match.groupId) : undefined;
    if (!stage || stage.kind === 'group') {
      if (group && match.round) {
        return {
          label: fmt(m.match.groupRound, { group: group.name, round: match.round }),
          shortLabel: fmt(m.match.groupRoundShort, { group: group.name, round: match.round }),
        };
      }
      const text = group ? fmt(m.match.group, { group: group.name }) : match.round ? fmt(m.match.round, { round: match.round }) : (stage?.name ?? '');
      return { label: text, shortLabel: text };
    }
    if (stage.kind === 'single') {
      const text = competition?.name ?? stage.name;
      return { label: text, shortLabel: text };
    }
    const siblings = raw.matches.filter((other) => other.stageId === stage.id).length;
    const text = siblings > 1 ? fmt(m.match.stage[stage.kind], { n: match.slot ?? '' }).trim() : m.match.stageName[stage.kind];
    return { label: text, shortLabel: text };
  }

  function placeholder(source: SlotSource | null): string | null {
    if (!source) return m.match.toBeDecided;
    if (source.kind === 'group_rank') {
      const group = groupById.get(source.groupId);
      if (!group) return m.match.toBeDecided;
      return source.rank === 1
        ? fmt(m.match.winnerOfGroup, { group: group.name })
        : fmt(m.match.rankOfGroup, { rank: source.rank, group: group.name });
    }
    const from = matchById.get(source.matchId);
    if (!from) return m.match.toBeDecided;
    const label = labelsFor(from).label.toLowerCase();
    return fmt(source.kind === 'match_winner' ? m.match.winnerOf : m.match.loserOf, { label });
  }

  const eventsByMatch = new Map<number, EventDTO[]>();
  for (const { event, roster, person } of raw.events) {
    const match = matchById.get(event.matchId);
    if (!match) continue;
    // Un autogol è registrato sulla squadra che lo commette ma vale per l'avversaria.
    const side: 'home' | 'away' = event.teamEntryId === match.homeEntryId ? 'home' : 'away';
    const playerName = person && roster ? publicPersonName(person, roster.shirtNumber, hiddenLabels).text : null;
    const list = eventsByMatch.get(event.matchId) ?? [];
    list.push({ id: event.id, type: event.type, minute: event.minute, side, playerName });
    eventsByMatch.set(event.matchId, list);
  }

  const matchDtos: MatchDTO[] = raw.matches.map((match) => {
    const stage = stageById.get(match.stageId);
    const competition = competitionById.get(match.competitionId);
    const group = match.groupId ? groupById.get(match.groupId) : undefined;
    const home = match.homeEntryId ? (teamByEntry.get(match.homeEntryId) ?? null) : null;
    const away = match.awayEntryId ? (teamByEntry.get(match.awayEntryId) ?? null) : null;
    return {
      id: match.id,
      competitionId: match.competitionId,
      competitionSlug: competition?.slug ?? '',
      competitionName: competition?.name ?? '',
      competitionType: competition?.type ?? 'cup',
      stageId: match.stageId,
      stageKind: stage?.kind ?? 'group',
      stageName: stage?.name ?? '',
      groupId: match.groupId,
      groupName: group?.name ?? null,
      round: match.round,
      slot: match.slot,
      ...labelsFor(match),
      home,
      away,
      homePlaceholder: home ? null : placeholder(match.homeSource),
      awayPlaceholder: away ? null : placeholder(match.awaySource),
      kickoffAt: iso(match.kickoffAt),
      fieldName: match.fieldId ? (fieldById.get(match.fieldId)?.name ?? null) : null,
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      homePens: match.homePens,
      awayPens: match.awayPens,
      decidedBy: match.decidedBy ?? decidedBy(match),
      winner: matchWinner(match),
      note: match.note,
      version: match.version,
      updatedAt: match.updatedAt.toISOString(),
      events: eventsByMatch.get(match.id) ?? [],
    };
  });

  const competitionDtos: CompetitionDTO[] = raw.competitions.map((competition) => ({
    id: competition.id,
    slug: competition.slug,
    name: competition.name,
    type: competition.type,
    stages: raw.stages
      .filter((stage) => stage.competitionId === competition.id)
      .map((stage) => ({
        id: stage.id,
        name: stage.name,
        kind: stage.kind,
        groups: raw.groups
          .filter((group) => group.stageId === stage.id)
          .map((group): GroupDTO => {
            const table = tables.get(group.id);
            const rows = (table?.result.rows ?? []).flatMap((row) => {
              const team = teamByEntry.get(row.teamId);
              if (!team) return [];
              return [
                {
                  team,
                  position: row.position,
                  played: row.played,
                  won: row.won,
                  drawn: row.drawn,
                  lost: row.lost,
                  goalsFor: row.goalsFor,
                  goalsAgainst: row.goalsAgainst,
                  goalDiff: row.goalDiff,
                  points: row.points,
                  tied: row.tied,
                  qualifies: false,
                },
              ];
            });
            // Le posizioni utili sono le prime N righe; con un pari merito aperto non si evidenzia chi è in bilico.
            rows.forEach((row, index) => {
              row.qualifies = index < config.qualify_per_group && !(row.tied && rows.filter((other) => other.position === row.position).length + row.position - 1 > config.qualify_per_group);
            });
            return {
              id: group.id,
              name: group.name,
              rows,
              provisional: table?.result.provisional ?? true,
              hasResults: rows.some((row) => row.played > 0),
              notes: (table?.result.notes ?? []).map((note) => ({
                criterion: note.criterion,
                teamCodes: note.teamIds.map((entryId) => teamByEntry.get(entryId)?.code ?? '?'),
              })),
            };
          }),
      })),
  }));

  const groupNameByEntry = new Map<number, { id: number; name: string }>();
  for (const { entry } of raw.entries) {
    const group = entry.groupId ? groupById.get(entry.groupId) : undefined;
    if (group) groupNameByEntry.set(entry.id, { id: group.id, name: group.name });
  }

  const teamDtos: EditionTeamDTO[] = raw.entries
    .filter(({ entry }) => entry.status !== 'withdrawn')
    .map(({ entry }) => {
      const ref = teamByEntry.get(entry.id) as TeamRef;
      const group = groupNameByEntry.get(entry.id);
      const roster = config.features.rosters
        ? raw.rosters
            .filter((row) => row.roster.teamEntryId === entry.id)
            .map((row) => {
              const name = publicPersonName(row.person, row.roster.shirtNumber, hiddenLabels);
              return { number: row.roster.shirtNumber, name: name.text, hidden: name.hidden, role: row.roster.role };
            })
        : null;
      return { ...ref, groupId: group?.id ?? null, groupName: group?.name ?? null, status: entry.status, roster };
    });

  return {
    edition: {
      id: raw.edition.id,
      year: raw.edition.year,
      name: raw.edition.name,
      status: raw.edition.status,
      startDate: raw.edition.startDate,
      endDate: raw.edition.endDate,
      registrationOpenAt: iso(raw.edition.registrationOpenAt),
      registrationCloseAt: iso(raw.edition.registrationCloseAt),
      rulesUrl: raw.edition.rulesUrl,
      config,
      venue: raw.venue ? { name: raw.venue.name, address: raw.venue.address, mapsUrl: raw.venue.mapsUrl } : null,
      isExample: raw.edition.source === 'example',
    },
    competitions: competitionDtos,
    teams: teamDtos,
    matches: matchDtos,
    stats: buildStats(raw, matchDtos, competitionDtos, teamByEntry, config.forfeit.goals_count_for_scorers, config.fair_play),
    cup: buildPodium(matchDtos),
    supercupWinner: supercupWinner(matchDtos),
  };
}

function winnerRef(match: MatchDTO): TeamRef | null {
  return match.winner === 'home' ? match.home : match.winner === 'away' ? match.away : null;
}

function loserRef(match: MatchDTO): TeamRef | null {
  return match.winner === 'home' ? match.away : match.winner === 'away' ? match.home : null;
}

function buildPodium(matchDtos: MatchDTO[]): PodiumDTO | null {
  const cupMatches = matchDtos.filter((match) => match.competitionType === 'cup' || match.competitionType === 'knockout');
  const final = cupMatches.find((match) => match.stageKind === 'final');
  const winner = final ? winnerRef(final) : null;
  if (!final || !winner) return null;
  const semifinalists = cupMatches
    .filter((match) => match.stageKind === 'semi')
    .map(loserRef)
    .filter((team): team is TeamRef => team !== null);
  return { winner, runnerUp: loserRef(final), semifinalists };
}

function supercupWinner(matchDtos: MatchDTO[]): TeamRef | null {
  const match = matchDtos.find((item) => item.competitionType === 'supercup' && isKnockout(item.stageKind));
  return match ? winnerRef(match) : null;
}

function buildStats(
  raw: EditionRaw,
  matchDtos: MatchDTO[],
  competitionDtos: CompetitionDTO[],
  teamByEntry: Map<number, TeamRef>,
  forfeitGoalsCount: boolean,
  fairPlayWeights: { yellow: number; red: number },
): StatsDTO {
  const played = matchDtos.filter((match) => match.status === 'finished' || match.status === 'forfeited');
  const forfeited = new Set(matchDtos.filter((match) => match.status === 'forfeited').map((match) => match.id));
  const matchById = new Map(matchDtos.map((match) => [match.id, match]));

  const goalsByRoster = new Map<number, number>();
  const discipline = new Map<number, { yellow: number; red: number }>();
  let yellow = 0;
  let red = 0;
  const mvps: StatsDTO['mvps'] = [];

  for (const { event, roster, person } of raw.events) {
    if (event.type === 'goal' && event.rosterEntryId !== null) {
      // T8: a tavolino i gol valgono per la classifica ma non per i marcatori.
      if (!forfeited.has(event.matchId) || forfeitGoalsCount) {
        goalsByRoster.set(event.rosterEntryId, (goalsByRoster.get(event.rosterEntryId) ?? 0) + 1);
      }
    }
    if (event.type === 'yellow' || event.type === 'red') {
      if (event.type === 'yellow') yellow += 1;
      else red += 1;
      const tally = discipline.get(event.teamEntryId) ?? { yellow: 0, red: 0 };
      tally[event.type] += 1;
      discipline.set(event.teamEntryId, tally);
    }
    if (event.type === 'mvp' && person && roster) {
      const match = matchById.get(event.matchId);
      const team = teamByEntry.get(event.teamEntryId);
      if (match && team) {
        mvps.push({ name: publicPersonName(person, roster.shirtNumber, hiddenLabels).text, teamCode: team.code, matchId: match.id, label: match.label });
      }
    }
  }

  const rosterById = new Map(raw.rosters.map((row) => [row.roster.id, row]));
  const topScorers: ScorerDTO[] = [...goalsByRoster.entries()]
    .flatMap(([rosterId, goals]) => {
      const row = rosterById.get(rosterId);
      const team = row ? teamByEntry.get(row.roster.teamEntryId) : undefined;
      if (!row || !team) return [];
      const name = publicPersonName(row.person, row.roster.shirtNumber, hiddenLabels);
      return [{ name: name.text, hidden: name.hidden, teamCode: team.code, teamSlug: team.slug, goals }];
    })
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'it'))
    .slice(0, 20);

  const groupRows = competitionDtos.flatMap((competition) => competition.stages.flatMap((stage) => stage.groups.flatMap((group) => group.rows))).filter((row) => row.played > 0);
  const stat = (row: (typeof groupRows)[number], value: number): TeamStatDTO => ({ teamCode: row.team.code, teamName: row.team.name, teamSlug: row.team.slug, value });
  const mostGoals = Math.max(-1, ...groupRows.map((row) => row.goalsFor));
  const fewestConceded = Math.min(Number.POSITIVE_INFINITY, ...groupRows.map((row) => row.goalsAgainst));

  const fairPlay: TeamStatDTO[] =
    yellow + red === 0
      ? []
      : [...teamByEntry.values()]
          .map((team) => {
            const tally = discipline.get(team.entryId) ?? { yellow: 0, red: 0 };
            return { teamCode: team.code, teamName: team.name, teamSlug: team.slug, value: tally.yellow * fairPlayWeights.yellow + tally.red * fairPlayWeights.red };
          })
          .sort((a, b) => a.value - b.value || a.teamName.localeCompare(b.teamName, 'it'));

  return {
    matchesPlayed: played.length,
    goals: played.reduce((sum, match) => sum + (match.homeScore ?? 0) + (match.awayScore ?? 0), 0),
    shootouts: played.filter((match) => match.decidedBy === 'penalties').length,
    yellow,
    red,
    topScorers,
    bestAttack: groupRows.filter((row) => row.goalsFor === mostGoals).map((row) => stat(row, row.goalsFor)),
    bestDefense: groupRows.filter((row) => row.goalsAgainst === fewestConceded).map((row) => stat(row, row.goalsAgainst)),
    fairPlay,
    mvps,
  };
}

export async function loadEditionBundle(db: Db, year: number): Promise<EditionBundle | null> {
  const [edition] = await db.select({ id: editions.id }).from(editions).where(eq(editions.year, year)).limit(1);
  if (!edition) return null;
  const raw = await fetchEditionRaw(db, edition.id);
  return raw ? buildEditionBundle(raw) : null;
}
