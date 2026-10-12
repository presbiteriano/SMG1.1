'use server';

import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import { competitions, fields, groups, matches, stages, teamEntries } from '@/db/schema';
import type { SlotSource, StageKind } from '@/db/schema/enums';
import { authorize, editionById, failed, integer, ok, text, type ActionState } from '@/lib/admin/action';
import { safeEditionConfig } from '@/lib/config/edition-config';
import { invalidate, tags } from '@/lib/data/invalidate';
import { createResultsProvider } from '@/lib/data/results-provider';
import { romeLocalToUtc } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';
import { assignSlots, knockoutPlan, roundRobin } from '@/lib/schedule/generate';

const lines = (value: string, pattern: RegExp) =>
  value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter((item) => pattern.test(item));

/**
 * Crea gironi all'italiana e tabellone a partire dalle squadre confermate (brief 9, proposta).
 * Le partite nascono come qualunque altra: passano da ResultsProvider e si possono correggere una a una.
 */
export async function generateCalendar(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('calendar.write');
  if ('denied' in auth) return auth.denied;
  const { db, user } = auth;
  const edition = await editionById(db, integer(data, 'editionId') ?? -1);
  if (!edition) return failed();
  const config = safeEditionConfig(edition.config);
  const labels = m.admin.generator;

  const [existing] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.editionId, edition.id), isNull(matches.archivedAt)))
    .limit(1);
  if (existing) return failed(labels.hasMatches);

  const entries = await db
    .select()
    .from(teamEntries)
    .where(and(eq(teamEntries.editionId, edition.id), ne(teamEntries.status, 'withdrawn')))
    .orderBy(asc(teamEntries.seed), asc(teamEntries.id));
  if (entries.length < config.groups * 2) return failed(labels.notEnoughTeams);

  const evenings = lines(text(data, 'evenings'), /^\d{4}-\d{2}-\d{2}$/);
  const knockoutEvenings = lines(text(data, 'knockoutEvenings'), /^\d{4}-\d{2}-\d{2}$/);
  const slots = lines(text(data, 'slots'), /^([01]\d|2[0-3]):[0-5]\d$/);
  const slotTimes = slots.length > 0 ? slots : config.schedule.slot_times;

  // Struttura: competizione, fase a gironi e gironi A, B, C... (si riusa ciò che esiste già).
  let [cup] = await db
    .select()
    .from(competitions)
    .where(and(eq(competitions.editionId, edition.id), eq(competitions.type, 'cup')))
    .limit(1);
  if (!cup) [cup] = await db.insert(competitions).values({ editionId: edition.id, type: 'cup', name: m.hall.cup, slug: 'coppa', order: 1 }).returning();

  const stageRows = await db.select().from(stages).where(eq(stages.competitionId, cup.id));
  const ensureStage = async (kind: StageKind, order: number) => {
    const found = stageRows.find((stage) => stage.kind === kind);
    if (found) return found;
    const [created] = await db.insert(stages).values({ competitionId: cup.id, name: m.match.stageName[kind], kind, order }).returning();
    stageRows.push(created);
    return created;
  };
  const groupStage = await ensureStage('group', 1);

  const groupRows = await db.select().from(groups).where(eq(groups.stageId, groupStage.id)).orderBy(asc(groups.order), asc(groups.id));
  for (let index = groupRows.length; index < config.groups; index += 1) {
    const [created] = await db.insert(groups).values({ stageId: groupStage.id, name: String.fromCharCode(65 + index), order: index + 1 }).returning();
    groupRows.push(created);
  }
  const activeGroups = groupRows.slice(0, config.groups);

  // Le squadre senza girone vanno nel girone meno pieno, in ordine di iscrizione.
  const members = new Map<number, number[]>(activeGroups.map((group) => [group.id, entries.filter((entry) => entry.groupId === group.id).map((entry) => entry.id)]));
  for (const entry of entries) {
    if (entry.groupId && members.has(entry.groupId)) continue;
    const target = [...members.entries()].sort((a, b) => a[1].length - b[1].length)[0];
    target[1].push(entry.id);
    await db.update(teamEntries).set({ groupId: target[0] }).where(eq(teamEntries.id, entry.id));
  }
  if ([...members.values()].some((list) => list.length < 2)) return failed(labels.notEnoughTeams);

  // Gironi: giornata per giornata, un girone dopo l'altro.
  const groupMatches = activeGroups
    .flatMap((group) => roundRobin(members.get(group.id) ?? []).map((pairing) => ({ ...pairing, groupId: group.id })))
    .sort((a, b) => a.round - b.round || activeGroups.findIndex((group) => group.id === a.groupId) - activeGroups.findIndex((group) => group.id === b.groupId));
  const placed = assignSlots(groupMatches, evenings, slotTimes);
  if (placed.some((match) => match.date === null)) return failed(labels.notEnoughEvenings);

  const [field] = await db.select().from(fields).orderBy(asc(fields.id)).limit(1);
  const provider = createResultsProvider(db, 'admin', { userId: user.id });
  const base = { editionId: edition.id, competitionId: cup.id, fieldId: field?.id ?? null, status: 'scheduled' as const };
  let created = 0;

  for (const match of placed) {
    await provider.upsertMatch({
      ...base,
      stageId: groupStage.id,
      groupId: match.groupId,
      round: match.round,
      homeEntryId: match.home,
      awayEntryId: match.away,
      kickoffAt: romeLocalToUtc(match.date as string, match.time as string),
    });
    created += 1;
  }

  const plan = knockoutPlan(config.groups, config.qualify_per_group);
  if (!plan) {
    invalidate(tags.edition(edition.year), tags.teams());
    return ok(`${fmt(labels.done, { n: created })} ${labels.unsupported}`);
  }

  const kinds = [...new Set(plan.map((match) => match.stage))];
  const idByKey = new Map<string, number>();
  for (const [roundIndex, kind] of kinds.entries()) {
    const stage = await ensureStage(kind, roundIndex + 2);
    const round = assignSlots(
      plan.filter((match) => match.stage === kind),
      knockoutEvenings[roundIndex] ? [knockoutEvenings[roundIndex]] : [],
      slotTimes,
    );
    for (const match of round) {
      const source = (from: (typeof match)['home']): SlotSource =>
        from.kind === 'group' ? { kind: 'group_rank', groupId: activeGroups[from.group].id, rank: from.rank } : { kind: 'match_winner', matchId: idByKey.get(`${from.stage}:${from.slot}`) as number };
      const saved = await provider.upsertMatch({
        ...base,
        stageId: stage.id,
        slot: match.slot,
        homeSource: source(match.home),
        awaySource: source(match.away),
        kickoffAt: match.date && match.time ? romeLocalToUtc(match.date, match.time) : null,
      });
      idByKey.set(`${kind}:${match.slot}`, saved.id);
      created += 1;
    }
  }

  invalidate(tags.edition(edition.year), tags.teams());
  return ok(fmt(labels.done, { n: created }));
}
