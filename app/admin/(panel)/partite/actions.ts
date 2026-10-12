'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { announcements, matchEvents, matches, teamEntries, teams } from '@/db/schema';
import { EVENT_TYPES } from '@/db/schema/enums';
import { authorize, checked, editionById, failed, integer, ok, optional, text, type ActionState } from '@/lib/admin/action';
import { safeEditionConfig } from '@/lib/config/edition-config';
import { writeAudit } from '@/lib/data/audit';
import type { Db } from '@/lib/data/db';
import { invalidate, tags } from '@/lib/data/invalidate';
import { createResultsProvider, MatchRuleViolation, undoLastMatchChange, VersionConflictError } from '@/lib/data/results-provider';
import { romeLocalToUtc } from '@/lib/datetime';
import { m } from '@/lib/i18n';
import { resultWarnings } from '@/lib/matches/rules';

// Risultati e stato delle partite. Tutto passa da ResultsProvider con provenienza 'admin':
// regole di integrità, versione, registro delle modifiche e avanzamento del tabellone.

function explain(error: unknown): ActionState {
  if (error instanceof VersionConflictError) return { status: 'conflict', message: m.admin.result.conflict };
  if (error instanceof MatchRuleViolation) return failed(error.codes.map((code) => m.admin.result.errors[code]).join(' '));
  console.error('[smg] azione sul pannello fallita', error);
  return failed();
}

async function loadMatch(db: Db, id: number | null) {
  if (id === null) return null;
  const [match] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  if (!match) return null;
  const edition = await editionById(db, match.editionId);
  return edition ? { match, edition } : null;
}

/** Inserimento del risultato in tre tocchi: partita, punteggio, salva (brief 9). */
export async function saveResult(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('results.write');
  if ('denied' in auth) return auth.denied;
  const found = await loadMatch(auth.db, integer(data, 'id'));
  if (!found) return failed(m.admin.result.errors.not_found);
  const { match, edition } = found;

  const homeScore = integer(data, 'homeScore');
  const awayScore = integer(data, 'awayScore');
  const status = text(data, 'status') === 'live' ? 'live' : 'finished';

  // Controlli anti-errore: non bloccano, chiedono conferma.
  const warnings = resultWarnings({ before: match, next: { homeScore, awayScore }, now: new Date() });
  if (warnings.length > 0 && !checked(data, 'confirm')) {
    return { status: 'confirm', warnings: warnings.map((warning) => m.admin.result.warnings[warning]) };
  }

  try {
    await createResultsProvider(auth.db, 'admin', { userId: auth.user.id }).upsertMatch({
      id: match.id,
      expectedVersion: integer(data, 'version') ?? -1,
      status,
      homeScore,
      awayScore,
      homePens: integer(data, 'homePens'),
      awayPens: integer(data, 'awayPens'),
    });
  } catch (error) {
    return explain(error);
  }
  invalidate(tags.match(edition.year, match.id));

  // Se c'erano già dei marcatori, si avvisa quando non tornano più con il punteggio.
  const events = await auth.db.select().from(matchEvents).where(eq(matchEvents.matchId, match.id));
  const goalsFor = (entryId: number | null, opponentId: number | null) =>
    events.filter((event) => (event.type === 'goal' && event.teamEntryId === entryId) || (event.type === 'own_goal' && event.teamEntryId === opponentId)).length;
  const hasGoals = events.some((event) => event.type === 'goal' || event.type === 'own_goal');
  const mismatch = hasGoals && (goalsFor(match.homeEntryId, match.awayEntryId) !== homeScore || goalsFor(match.awayEntryId, match.homeEntryId) !== awayScore);
  return ok(mismatch ? `${m.admin.result.saved} ${m.admin.result.warnings.events_mismatch}` : m.admin.result.saved);
}

/** Cambio di stato con un tocco: da giocare, rinviata, annullata, a tavolino (brief 9). */
export async function setMatchStatus(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('results.write');
  if ('denied' in auth) return auth.denied;
  const found = await loadMatch(auth.db, integer(data, 'id'));
  if (!found) return failed(m.admin.result.errors.not_found);
  const { match, edition } = found;
  const next = text(data, 'next');
  const config = safeEditionConfig(edition.config);
  const provider = createResultsProvider(auth.db, 'admin', { userId: auth.user.id });
  const expectedVersion = integer(data, 'version') ?? -1;
  const note = optional(data, 'note');

  try {
    if (next === 'forfeit_home' || next === 'forfeit_away') {
      const homeWins = next === 'forfeit_home';
      await provider.upsertMatch({
        id: match.id,
        expectedVersion,
        status: 'forfeited',
        homeScore: homeWins ? config.forfeit.winner_score : config.forfeit.loser_score,
        awayScore: homeWins ? config.forfeit.loser_score : config.forfeit.winner_score,
        note,
      });
    } else if (next === 'postponed' || next === 'cancelled' || next === 'scheduled' || next === 'live') {
      await provider.upsertMatch({ id: match.id, expectedVersion, status: next, note: next === 'scheduled' ? null : (note ?? match.note) });
    } else {
      return failed();
    }
  } catch (error) {
    return explain(error);
  }

  const touched = [tags.match(edition.year, match.id)];
  if (next === 'postponed' && checked(data, 'announce')) {
    // Avviso con un tocco: compare in cima a ogni pagina fino a domani sera (scena 3 del brief).
    const names = await auth.db
      .select({ id: teamEntries.id, code: teams.shortCode })
      .from(teamEntries)
      .innerJoin(teams, eq(teams.id, teamEntries.teamId))
      .where(eq(teamEntries.editionId, edition.id));
    const code = (entryId: number | null) => names.find((item) => item.id === entryId)?.code ?? '?';
    const now = new Date();
    await auth.db.insert(announcements).values({
      severity: 'warning',
      title: m.admin.result.postponeTitle,
      body: `${code(match.homeEntryId)}-${code(match.awayEntryId)}${note ? `: ${note}` : ''}`,
      startsAt: now,
      endsAt: new Date(now.getTime() + 36 * 3_600_000),
      link: `/edizioni/${edition.year}/partite/${match.id}`,
      editionId: edition.id,
      createdBy: auth.user.id,
    });
    touched.push(tags.site());
  }
  invalidate(...touched);
  return ok(m.admin.result.statusSaved);
}

export async function saveSchedule(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('results.write');
  if ('denied' in auth) return auth.denied;
  const found = await loadMatch(auth.db, integer(data, 'id'));
  if (!found) return failed(m.admin.result.errors.not_found);
  const date = text(data, 'date');
  const time = text(data, 'time');
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time);
  try {
    await createResultsProvider(auth.db, 'admin', { userId: auth.user.id }).upsertMatch({
      id: found.match.id,
      expectedVersion: integer(data, 'version') ?? -1,
      kickoffAt: valid ? romeLocalToUtc(date, time) : null,
      fieldId: integer(data, 'fieldId'),
    });
  } catch (error) {
    return explain(error);
  }
  invalidate(tags.match(found.edition.year, found.match.id));
  return ok(m.admin.result.scheduleSaved);
}

const eventsSchema = z
  .array(
    z.object({
      type: z.enum(EVENT_TYPES),
      minute: z.number().int().min(0).max(200).nullable(),
      teamEntryId: z.number().int().positive(),
      rosterEntryId: z.number().int().positive().nullable(),
    }),
  )
  .max(80);

/** Marcatori e cartellini: facoltativi, si aggiungono anche dopo. */
export async function saveEvents(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('results.write');
  if ('denied' in auth) return auth.denied;
  const found = await loadMatch(auth.db, integer(data, 'id'));
  if (!found) return failed(m.admin.result.errors.not_found);
  let payload: unknown;
  try {
    payload = JSON.parse(text(data, 'events'));
  } catch {
    return failed();
  }
  const parsed = eventsSchema.safeParse(payload);
  if (!parsed.success) return failed();
  try {
    await createResultsProvider(auth.db, 'admin', { userId: auth.user.id }).upsertEvents(found.match.id, parsed.data);
  } catch (error) {
    return explain(error);
  }
  invalidate(tags.match(found.edition.year, found.match.id));
  return ok(m.admin.result.eventsSaved);
}

/** «Annulla»: torna alla versione precedente, lasciando traccia nel registro. */
export async function undoMatch(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('results.write');
  if ('denied' in auth) return auth.denied;
  const found = await loadMatch(auth.db, integer(data, 'id'));
  if (!found) return failed(m.admin.result.errors.not_found);
  try {
    const restored = await undoLastMatchChange(auth.db, found.match.id, { userId: auth.user.id });
    if (!restored) return failed(m.admin.result.nothingToUndo);
  } catch (error) {
    return explain(error);
  }
  invalidate(tags.match(found.edition.year, found.match.id));
  return ok(m.admin.result.undone);
}

export async function createMatch(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('calendar.write');
  if ('denied' in auth) return auth.denied;
  const edition = await editionById(auth.db, integer(data, 'editionId') ?? -1);
  const [competitionId, stageId] = text(data, 'stage').split(':').map(Number);
  if (!edition || !competitionId || !stageId) return failed();
  const date = text(data, 'date');
  const time = text(data, 'time');
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time);
  let createdId: number;
  try {
    const created = await createResultsProvider(auth.db, 'admin', { userId: auth.user.id }).upsertMatch({
      editionId: edition.id,
      competitionId,
      stageId,
      groupId: integer(data, 'groupId'),
      round: integer(data, 'round'),
      slot: integer(data, 'slot'),
      homeEntryId: integer(data, 'homeEntryId'),
      awayEntryId: integer(data, 'awayEntryId'),
      kickoffAt: valid ? romeLocalToUtc(date, time) : null,
      fieldId: integer(data, 'fieldId'),
      status: 'scheduled',
    });
    createdId = created.id;
  } catch (error) {
    return explain(error);
  }
  invalidate(tags.edition(edition.year));
  redirect(`/admin/partite/${createdId}`);
}

/** Una partita con dati collegati non si cancella: si archivia (brief 11.2). */
export async function archiveMatch(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('calendar.write');
  if ('denied' in auth) return auth.denied;
  const found = await loadMatch(auth.db, integer(data, 'id'));
  if (!found) return failed(m.admin.result.errors.not_found);
  await auth.db.update(matches).set({ archivedAt: new Date(), updatedBy: auth.user.id }).where(and(eq(matches.id, found.match.id), isNull(matches.archivedAt)));
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'match', entityId: found.match.id, action: 'archive' });
  invalidate(tags.match(found.edition.year, found.match.id));
  redirect(`/admin/partite?edizione=${found.edition.year}`);
}
