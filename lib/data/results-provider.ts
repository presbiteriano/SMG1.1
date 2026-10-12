import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { auditLog, editions, matchEvents, matches, stages, teamEntries } from '@/db/schema';
import type { DataSource, MatchEventType, MatchStatus, SlotSource } from '@/db/schema/enums';
import { resolveSlots } from '@/lib/bracket/resolve';
import { safeEditionConfig } from '@/lib/config/edition-config';
import { normalizeMatchState, validateMatchState, type MatchRuleError } from '@/lib/matches/rules';
import { writeAudit } from './audit';
import type { Db } from './db';
import { buildGroupTables, fetchEditionRaw, type MatchRow } from './edition-raw';

// «Una sola fonte, tante porte» (brief 10): ogni dato di gara entra nel database da qui,
// qualunque sia la provenienza, e ogni modifica viene validata, versionata e registrata.
//
//   pannello di gestione  -> createResultsProvider(db, 'admin', { userId })
//   importazione CSV      -> createResultsProvider(db, 'csv', { userId })
//   edizione di esempio   -> createResultsProvider(db, 'example')
//   TuttoCampo            -> NON implementare finché non esistono permesso scritto E feed ufficiale.

export type MatchInput = {
  /** Assente per una partita nuova. */
  id?: number;
  /** Versione letta da chi modifica: se nel frattempo è cambiata, il salvataggio riceve un conflitto. */
  expectedVersion?: number;
  editionId?: number;
  competitionId?: number;
  stageId?: number;
  groupId?: number | null;
  round?: number | null;
  slot?: number | null;
  homeEntryId?: number | null;
  awayEntryId?: number | null;
  homeSource?: SlotSource | null;
  awaySource?: SlotSource | null;
  kickoffAt?: Date | null;
  fieldId?: number | null;
  status?: MatchStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  homePens?: number | null;
  awayPens?: number | null;
  note?: string | null;
};

export type MatchEventInput = {
  type: MatchEventType;
  minute: number | null;
  teamEntryId: number;
  rosterEntryId: number | null;
};

export interface ResultsProvider {
  readonly source: DataSource;
  upsertMatch(input: MatchInput): Promise<MatchRow>;
  upsertEvents(matchId: number, events: MatchEventInput[]): Promise<void>;
}

export class VersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('version_conflict');
    this.name = 'VersionConflictError';
  }
}

export class MatchRuleViolation extends Error {
  constructor(public readonly codes: MatchRuleError[]) {
    super(`match_rule_violation: ${codes.join(', ')}`);
    this.name = 'MatchRuleViolation';
  }
}

export type Actor = { userId: number | null };

const SNAPSHOT_FIELDS = [
  'status',
  'homeScore',
  'awayScore',
  'homePens',
  'awayPens',
  'homeEntryId',
  'awayEntryId',
  'kickoffAt',
  'fieldId',
  'note',
  'version',
] as const;

export function matchSnapshot(row: MatchRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of SNAPSHOT_FIELDS) {
    const value = row[key];
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

function defined<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

async function scheduleConflicts(tx: Db, next: MatchRow, matchMinutes: number): Promise<MatchRuleError[]> {
  if (!next.kickoffAt || next.status === 'cancelled' || next.status === 'postponed') return [];
  const others = await tx
    .select()
    .from(matches)
    .where(and(eq(matches.editionId, next.editionId), isNull(matches.archivedAt), ne(matches.id, next.id ?? -1)));
  const window = matchMinutes * 60_000;
  const start = next.kickoffAt.getTime();
  const errors = new Set<MatchRuleError>();
  for (const other of others) {
    if (!other.kickoffAt || other.status === 'cancelled' || other.status === 'postponed') continue;
    if (Math.abs(other.kickoffAt.getTime() - start) >= window) continue;
    if (next.fieldId !== null && other.fieldId === next.fieldId) errors.add('field_busy');
    const teams = [next.homeEntryId, next.awayEntryId].filter((entryId): entryId is number => entryId !== null);
    if (teams.some((entryId) => entryId === other.homeEntryId || entryId === other.awayEntryId)) errors.add('team_busy');
  }
  return [...errors];
}

/** Dopo ogni scrittura: riempie le caselle del tabellone che ora sono decise. */
export async function advanceBracket(tx: Db, editionId: number, actor: Actor, source: DataSource): Promise<number[]> {
  const raw = await fetchEditionRaw(tx, editionId);
  if (!raw) return [];
  const tables = buildGroupTables(raw, safeEditionConfig(raw.edition.config));
  const updates = resolveSlots(raw.matches, (groupId, rank) => {
    const table = tables.get(groupId);
    if (!table?.complete) return null;
    const row = table.result.rows[rank - 1];
    return row && !row.tied ? row.teamId : null;
  });
  for (const update of updates) {
    const before = raw.matches.find((match) => match.id === update.matchId);
    if (!before) continue;
    const [after] = await tx
      .update(matches)
      .set({ homeEntryId: update.homeEntryId, awayEntryId: update.awayEntryId, version: before.version + 1, updatedAt: new Date() })
      .where(eq(matches.id, update.matchId))
      .returning();
    await writeAudit(tx, {
      userId: actor.userId,
      entity: 'match',
      entityId: update.matchId,
      action: 'advance',
      before: matchSnapshot(before),
      after: matchSnapshot(after),
      source,
    });
  }
  return updates.map((update) => update.matchId);
}

export function createResultsProvider(db: Db, source: DataSource, actor: Actor = { userId: null }): ResultsProvider {
  return {
    source,

    async upsertMatch(input) {
      return db.transaction(async (tx) => {
        const now = new Date();
        const [current] = input.id ? await tx.select().from(matches).where(eq(matches.id, input.id)).limit(1) : [];
        if (input.id && !current) throw new MatchRuleViolation(['not_found']);
        if (current && input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
          throw new VersionConflictError(current.version);
        }

        const { id: _id, expectedVersion: _expected, ...changes } = input;
        void _id;
        void _expected;
        const merged = { ...(current ?? {}), ...defined(changes) } as Partial<MatchRow>;
        if (!merged.editionId || !merged.competitionId || !merged.stageId) throw new MatchRuleViolation(['not_found']);

        const [stage] = await tx.select().from(stages).where(eq(stages.id, merged.stageId)).limit(1);
        const [edition] = await tx.select().from(editions).where(eq(editions.id, merged.editionId)).limit(1);
        if (!stage || !edition) throw new MatchRuleViolation(['not_found']);
        const config = safeEditionConfig(edition.config);
        const knockout = stage.kind !== 'group';

        const next = normalizeMatchState(
          {
            status: merged.status ?? 'scheduled',
            homeEntryId: merged.homeEntryId ?? null,
            awayEntryId: merged.awayEntryId ?? null,
            homeScore: merged.homeScore ?? null,
            awayScore: merged.awayScore ?? null,
            homePens: merged.homePens ?? null,
            awayPens: merged.awayPens ?? null,
          },
          { knockout },
        );

        const errors = validateMatchState(next, { knockout });

        const groupId = merged.groupId ?? null;
        const entryIds = [next.homeEntryId, next.awayEntryId].filter((entryId): entryId is number => entryId !== null);
        if (groupId !== null && entryIds.length > 0) {
          const entries = await tx.select().from(teamEntries).where(inArray(teamEntries.id, entryIds));
          if (entries.some((entry) => entry.groupId !== groupId)) errors.push('group_mismatch');
        }

        const values = {
          editionId: merged.editionId,
          competitionId: merged.competitionId,
          stageId: merged.stageId,
          groupId,
          round: merged.round ?? null,
          slot: merged.slot ?? null,
          homeSource: merged.homeSource ?? null,
          awaySource: merged.awaySource ?? null,
          kickoffAt: merged.kickoffAt ?? null,
          fieldId: merged.fieldId ?? null,
          note: merged.note ?? null,
          ...next,
        };

        const scheduleChanged =
          !current ||
          current.kickoffAt?.getTime() !== values.kickoffAt?.getTime() ||
          current.fieldId !== values.fieldId ||
          current.homeEntryId !== values.homeEntryId ||
          current.awayEntryId !== values.awayEntryId ||
          (current.status !== values.status && (current.status === 'postponed' || current.status === 'cancelled'));
        if (scheduleChanged) {
          errors.push(...(await scheduleConflicts(tx, { ...(current ?? {}), ...values, id: current?.id ?? -1 } as MatchRow, config.schedule.match_minutes)));
        }
        if (errors.length > 0) throw new MatchRuleViolation([...new Set(errors)]);

        let saved: MatchRow;
        if (current) {
          // Il controllo sulla versione è anche nella clausola WHERE: due salvataggi contemporanei non si sovrascrivono.
          const [updated] = await tx
            .update(matches)
            .set({ ...values, version: current.version + 1, updatedBy: actor.userId, updatedAt: now })
            .where(and(eq(matches.id, current.id), eq(matches.version, current.version)))
            .returning();
          if (!updated) throw new VersionConflictError(current.version + 1);
          saved = updated;
        } else {
          const [created] = await tx
            .insert(matches)
            .values({ ...values, version: 1, updatedBy: actor.userId, updatedAt: now, source })
            .returning();
          saved = created;
        }

        await writeAudit(tx, {
          userId: actor.userId,
          entity: 'match',
          entityId: saved.id,
          action: current ? 'update' : 'create',
          before: current ? matchSnapshot(current) : null,
          after: matchSnapshot(saved),
          source,
        });

        await advanceBracket(tx, saved.editionId, actor, source);
        return saved;
      });
    },

    async upsertEvents(matchId, events) {
      await db.transaction(async (tx) => {
        const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1);
        if (!match) throw new MatchRuleViolation(['not_found']);
        const allowed = new Set([match.homeEntryId, match.awayEntryId]);
        if (events.some((event) => !allowed.has(event.teamEntryId))) throw new MatchRuleViolation(['teams_required']);

        const before = await tx.select().from(matchEvents).where(eq(matchEvents.matchId, matchId));
        await tx.delete(matchEvents).where(eq(matchEvents.matchId, matchId));
        if (events.length > 0) {
          await tx.insert(matchEvents).values(events.map((event) => ({ ...event, matchId, source })));
        }
        // Anche la cronaca è una modifica della partita: nuova versione e riga nel registro.
        await tx
          .update(matches)
          .set({ version: match.version + 1, updatedBy: actor.userId, updatedAt: new Date() })
          .where(eq(matches.id, matchId));
        await writeAudit(tx, {
          userId: actor.userId,
          entity: 'match',
          entityId: matchId,
          action: 'events',
          before: { events: before.map((event) => ({ type: event.type, minute: event.minute, teamEntryId: event.teamEntryId, rosterEntryId: event.rosterEntryId })) },
          after: { events },
          source,
        });
        // I cartellini possono cambiare il fair play e quindi chi passa il turno.
        await advanceBracket(tx, match.editionId, actor, source);
      });
    },
  };
}

/** «Annulla»: riporta la partita allo stato precedente l'ultima modifica, come nuova versione. */
export async function undoLastMatchChange(db: Db, matchId: number, actor: Actor): Promise<MatchRow | null> {
  const [last] = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entity, 'match'), eq(auditLog.entityId, String(matchId)), eq(auditLog.action, 'update')))
    .orderBy(desc(auditLog.id))
    .limit(1);
  const before = last?.before as (Partial<Record<(typeof SNAPSHOT_FIELDS)[number], unknown>> & { kickoffAt?: string | null }) | null | undefined;
  if (!before) return null;
  return createResultsProvider(db, 'admin', actor).upsertMatch({
    id: matchId,
    status: before.status as MatchStatus,
    homeScore: (before.homeScore as number | null) ?? null,
    awayScore: (before.awayScore as number | null) ?? null,
    homePens: (before.homePens as number | null) ?? null,
    awayPens: (before.awayPens as number | null) ?? null,
    kickoffAt: before.kickoffAt ? new Date(before.kickoffAt) : null,
    fieldId: (before.fieldId as number | null) ?? null,
    note: (before.note as string | null) ?? null,
  });
}
