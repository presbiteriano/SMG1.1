import { asc, eq } from 'drizzle-orm';
import { editions, registrations } from '@/db/schema';
import { adminEdition } from '@/lib/admin/data';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { toCsv } from '@/lib/csv';
import { writeAudit } from '@/lib/data/audit';
import { getDb } from '@/lib/data/db';
import { formatRome, romeDateKey, romeTimeKey } from '@/lib/datetime';
import { m } from '@/lib/i18n';
import { parseYear } from '@/lib/site';

// Esportazione CSV per edizione (brief 13.3): iscrizioni e partite. Riservata a chi ha il permesso;
// ogni esportazione delle iscrizioni resta nel registro, perché contiene dati personali.
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const user = await getSessionUser();
  if (!user || !can(user.role, 'export.read')) return new Response(null, { status: 404 });
  const { kind } = await params;
  const year = parseYear(new URL(request.url).searchParams.get('edizione') ?? undefined);
  const db = await getDb();
  const [edition] = year ? await db.select().from(editions).where(eq(editions.year, year)).limit(1) : [];
  if (!edition) return new Response(null, { status: 404 });

  let csv: string;
  if (kind === 'iscrizioni') {
    const rows = await db.select().from(registrations).where(eq(registrations.editionId, edition.id)).orderBy(asc(registrations.createdAt));
    const labels = m.admin.registrations;
    csv = toCsv(
      [labels.team, labels.contact, m.registration.phone, m.registration.email, labels.players, labels.minors, m.admin.common.status, labels.received, m.admin.common.notes, labels.internal],
      rows.map((row) => [row.teamName, row.contactName, row.contactPhone, row.contactEmail, row.playersCount, row.hasMinors ? m.admin.common.yes : m.admin.common.no, labels.statuses[row.status], formatRome(row.createdAt, 'dateTime'), row.notes, row.internalNotes]),
    );
    await writeAudit(db, { userId: user.id, entity: 'registration', entityId: `edizione-${edition.year}`, action: 'export', after: { rows: rows.length } });
  } else if (kind === 'partite') {
    const loaded = await adminEdition(db, edition.id);
    // Stesse colonne dell'importazione: un file esportato si può reimportare così com'è.
    csv = toCsv(
      ['competizione', 'fase', 'girone', 'giornata', 'data', 'ora', 'casa', 'ospite', 'gol_casa', 'gol_ospite', 'rigori_casa', 'rigori_ospite', 'stato'],
      (loaded?.bundle.matches ?? []).map((match) => [
        match.competitionName,
        match.stageName,
        match.groupName,
        match.round,
        match.kickoffAt ? romeDateKey(match.kickoffAt) : '',
        match.kickoffAt ? romeTimeKey(match.kickoffAt) : '',
        match.home?.name ?? '',
        match.away?.name ?? '',
        match.homeScore,
        match.awayScore,
        match.homePens,
        match.awayPens,
        m.status[match.status],
      ]),
    );
  } else {
    return new Response(null, { status: 404 });
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="smg-${edition.year}-${kind}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
