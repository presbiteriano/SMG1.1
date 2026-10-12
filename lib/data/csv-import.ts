import { and, asc, eq } from 'drizzle-orm';
import { competitions, editions, groups, stages, teamEntries, teams } from '@/db/schema';
import type { StageKind } from '@/db/schema/enums';
import { safeEditionConfig } from '@/lib/config/edition-config';
import type { CsvMatchRow } from '@/lib/csv';
import { romeLocalToUtc } from '@/lib/datetime';
import { m } from '@/lib/i18n';
import { foldText, slugify, suggestShortCode } from '@/lib/slug';
import type { Db } from './db';
import { createResultsProvider, MatchRuleViolation, type Actor } from './results-provider';

// CsvImportProvider (brief 10): importazione dei dati storici e di emergenza. Le partite entrano
// dallo stesso punto d'ingresso del pannello, con provenienza 'csv' registrata su ogni riga.

const sameName = (a: string, b: string) => foldText(a).replace(/[^a-z0-9]/g, '') === foldText(b).replace(/[^a-z0-9]/g, '');

/** Squadre citate nel file che non esistono ancora: verranno create alla conferma. */
export async function missingTeams(db: Db, rows: CsvMatchRow[]): Promise<string[]> {
  const known = await db.select({ name: teams.name }).from(teams);
  const names = [...new Set(rows.flatMap((row) => [row.home, row.away]).filter(Boolean))];
  return names.filter((name) => !known.some((team) => sameName(team.name, name)));
}

export type ImportReport = { imported: number; failures: { line: number; codes: string[] }[] };

export async function importMatches(db: Db, editionId: number, rows: CsvMatchRow[], actor: Actor): Promise<ImportReport> {
  const [edition] = await db.select().from(editions).where(eq(editions.id, editionId)).limit(1);
  if (!edition) return { imported: 0, failures: [] };
  const config = safeEditionConfig(edition.config);
  const provider = createResultsProvider(db, 'csv', actor);

  const competitionRows = await db.select().from(competitions).where(eq(competitions.editionId, editionId));
  const stageRows = competitionRows.length ? await db.select().from(stages) : [];
  const groupRows = await db.select().from(groups);
  const teamRows = await db.select().from(teams);
  const entryRows = await db.select().from(teamEntries).where(eq(teamEntries.editionId, editionId));
  const slots = new Map<number, number>();

  const competitionFor = async (row: CsvMatchRow) => {
    const supercup = row.stage === 'single';
    const name = row.competition || (supercup ? m.hall.supercup : m.hall.cup);
    let found = competitionRows.find((item) => sameName(item.name, name));
    if (!found) {
      [found] = await db
        .insert(competitions)
        .values({ editionId, type: supercup ? 'supercup' : 'cup', name, slug: slugify(name) || 'coppa', order: competitionRows.length + 1, source: 'csv' })
        .returning();
      competitionRows.push(found);
    }
    return found;
  };

  const ORDER: Record<StageKind, number> = { group: 1, round_of_16: 2, quarter: 3, semi: 4, third_place: 5, final: 6, single: 1 };
  const stageFor = async (competitionId: number, kind: StageKind) => {
    let found = stageRows.find((item) => item.competitionId === competitionId && item.kind === kind);
    if (!found) {
      [found] = await db.insert(stages).values({ competitionId, name: m.match.stageName[kind], kind, order: ORDER[kind], source: 'csv' }).returning();
      stageRows.push(found);
    }
    return found;
  };

  const groupFor = async (stageId: number, name: string | null) => {
    if (!name) return null;
    let found = groupRows.find((item) => item.stageId === stageId && item.name === name);
    if (!found) {
      const order = groupRows.filter((item) => item.stageId === stageId).length + 1;
      [found] = await db.insert(groups).values({ stageId, name, order, source: 'csv' }).returning();
      groupRows.push(found);
    }
    return found;
  };

  const entryFor = async (name: string, groupId: number | null) => {
    let team = teamRows.find((item) => sameName(item.name, name));
    if (!team) {
      const base = slugify(name) || 'squadra';
      let slug = base;
      for (let n = 2; teamRows.some((item) => item.slug === slug); n += 1) slug = `${base}-${n}`;
      [team] = await db.insert(teams).values({ slug, name, shortCode: suggestShortCode(name), source: 'csv' }).returning();
      teamRows.push(team);
    }
    let entry = entryRows.find((item) => item.teamId === team.id);
    if (!entry) {
      [entry] = await db.insert(teamEntries).values({ editionId, teamId: team.id, groupId, status: 'confirmed', source: 'csv' }).returning();
      entryRows.push(entry);
    } else if (groupId !== null && entry.groupId === null) {
      await db.update(teamEntries).set({ groupId }).where(and(eq(teamEntries.id, entry.id)));
      entry.groupId = groupId;
    }
    return entry;
  };

  const report: ImportReport = { imported: 0, failures: [] };
  for (const row of rows) {
    if (row.errors.length > 0) continue;
    try {
      const competition = await competitionFor(row);
      const stage = await stageFor(competition.id, row.stage);
      const group = row.stage === 'group' ? await groupFor(stage.id, row.group) : null;
      const home = await entryFor(row.home, group?.id ?? null);
      const away = await entryFor(row.away, group?.id ?? null);
      const slot = row.stage === 'group' ? null : (slots.get(stage.id) ?? 0) + 1;
      if (slot !== null) slots.set(stage.id, slot);
      await provider.upsertMatch({
        editionId,
        competitionId: competition.id,
        stageId: stage.id,
        groupId: group?.id ?? null,
        round: row.round,
        slot,
        homeEntryId: home.id,
        awayEntryId: away.id,
        kickoffAt: row.date ? romeLocalToUtc(row.date, row.time ?? config.schedule.slot_times[0] ?? '20:00') : null,
        status: row.status,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        homePens: row.homePens,
        awayPens: row.awayPens,
      });
      report.imported += 1;
    } catch (error) {
      if (!(error instanceof MatchRuleViolation)) throw error;
      report.failures.push({ line: row.line, codes: error.codes });
    }
  }
  return report;
}

export async function editionYears(db: Db): Promise<number[]> {
  return (await db.select({ year: editions.year }).from(editions).orderBy(asc(editions.year))).map((row) => row.year);
}
