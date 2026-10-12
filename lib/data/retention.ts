import { and, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { analyticsDaily, auditLog, editions, people, registrations, rosterEntries, teamEntries } from '@/db/schema';
import { purgeExpiredAuth } from '@/lib/auth/store';
import { romeDateKey } from '@/lib/datetime';
import type { Db } from './db';

// Conservazione dei dati (brief 13.9, proposte da far validare). Da eseguire una volta al giorno:
// `npm run db:retention` oppure una chiamata programmata a /api/cron/retention.

export const RETENTION = {
  /** Contatti dei referenti: mesi dopo la fine dell'edizione. */
  registrationMonths: 12,
  /** Nomi delle persone in rosa: anni dopo l'ultima edizione giocata, poi resi anonimi. */
  personYears: 3,
  /** Registro delle modifiche e statistiche aggregate. */
  logMonths: 24,
} as const;

function monthsAgo(now: Date, months: number): Date {
  const copy = new Date(now);
  copy.setUTCMonth(copy.getUTCMonth() - months);
  return copy;
}

export type RetentionReport = { registrations: number; people: number; auditRows: number; analyticsRows: number };

export async function runRetention(db: Db, now: Date = new Date()): Promise<RetentionReport> {
  // Iscrizioni: via 12 mesi dopo la fine dell'edizione.
  const registrationCutoff = romeDateKey(monthsAgo(now, RETENTION.registrationMonths));
  const oldEditions = await db
    .select({ id: editions.id })
    .from(editions)
    .where(and(isNotNull(editions.endDate), lt(editions.endDate, registrationCutoff)));
  const removedRegistrations = oldEditions.length
    ? await db
        .delete(registrations)
        .where(
          inArray(
            registrations.editionId,
            oldEditions.map((row) => row.id),
          ),
        )
        .returning({ id: registrations.id })
    : [];

  // Persone: anonime 3 anni dopo l'ultima edizione a cui hanno partecipato. I risultati restano.
  const personCutoff = romeDateKey(monthsAgo(now, RETENTION.personYears * 12));
  const lastSeen = await db
    .select({ personId: rosterEntries.personId, last: sql<string | null>`max(${editions.endDate})` })
    .from(rosterEntries)
    .innerJoin(teamEntries, eq(teamEntries.id, rosterEntries.teamEntryId))
    .innerJoin(editions, eq(editions.id, teamEntries.editionId))
    .groupBy(rosterEntries.personId);
  const stale = lastSeen.filter((row) => row.last !== null && row.last < personCutoff).map((row) => row.personId);
  const anonymized = stale.length
    ? await db
        .update(people)
        .set({ firstName: 'Giocatore', lastName: '', publishNameMode: 'hidden', anonymizedAt: now })
        .where(and(inArray(people.id, stale), isNull(people.anonymizedAt)))
        .returning({ id: people.id })
    : [];

  const logCutoff = monthsAgo(now, RETENTION.logMonths);
  const removedAudit = await db.delete(auditLog).where(lt(auditLog.at, logCutoff)).returning({ id: auditLog.id });
  const removedAnalytics = await db
    .delete(analyticsDaily)
    .where(lt(analyticsDaily.day, romeDateKey(logCutoff)))
    .returning({ day: analyticsDaily.day });

  await purgeExpiredAuth(db, now);

  return {
    registrations: removedRegistrations.length,
    people: anonymized.length,
    auditRows: removedAudit.length,
    analyticsRows: removedAnalytics.length,
  };
}
