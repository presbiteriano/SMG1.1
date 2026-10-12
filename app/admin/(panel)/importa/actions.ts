'use server';

import { authorize, editionById, failed, integer, ok, type ActionState } from '@/lib/admin/action';
import { parseMatchesCsv } from '@/lib/csv';
import { writeAudit } from '@/lib/data/audit';
import { importMatches, missingTeams } from '@/lib/data/csv-import';
import { invalidate, tags } from '@/lib/data/invalidate';
import { fmt, m } from '@/lib/i18n';

const labels = m.admin.import;

/**
 * Importazione CSV in due passi (brief 9): prima l'anteprima, poi la conferma.
 * Con intent=preview non si scrive nulla nel database.
 */
export async function importCsv(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('import.write');
  if ('denied' in auth) return auth.denied;
  const edition = await editionById(auth.db, integer(data, 'editionId') ?? -1);
  if (!edition) return failed();
  const csv = String(data.get('csv') ?? '').slice(0, 400_000);
  const { rows, headerOk } = parseMatchesCsv(csv);
  if (!headerOk) return failed(labels.errors.header);

  const good = rows.filter((row) => row.errors.length === 0);
  const bad = rows.filter((row) => row.errors.length > 0);
  const problems = bad.slice(0, 20).map((row) => `${fmt(labels.line, { n: row.line })}: ${row.errors.map((error) => labels.errors[error]).join(', ')}`);

  if (data.get('intent') !== 'confirm') {
    const newTeams = await missingTeams(auth.db, good);
    return {
      status: 'ok',
      message: fmt(labels.rows, { ok: good.length, bad: bad.length }),
      warnings: [...problems, ...(newTeams.length > 0 ? [fmt(labels.newTeams, { teams: newTeams.join(', ') })] : [])],
      extra: {
        ready: String(good.length),
        preview: JSON.stringify(
          good.slice(0, 40).map((row) => [row.line, row.date ?? '', row.time ?? '', row.home, row.away, row.homeScore === null ? '' : `${row.homeScore}-${row.awayScore}`]),
        ),
      },
    };
  }

  const report = await importMatches(auth.db, edition.id, good, { userId: auth.user.id });
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'edition', entityId: edition.id, action: 'csv_import', after: { imported: report.imported, failed: report.failures.length }, source: 'csv' });
  invalidate(tags.edition(edition.year), tags.teams());
  return {
    ...ok(fmt(labels.done, { n: report.imported })),
    warnings: report.failures.map((failure) => `${fmt(labels.line, { n: failure.line })}: ${failure.codes.map((code) => m.admin.result.errors[code as keyof typeof m.admin.result.errors] ?? code).join(' ')}`),
  };
}
