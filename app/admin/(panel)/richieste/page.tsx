import { desc } from 'drizzle-orm';
import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { AdminTitle } from '@/components/admin/ui';
import { Pill } from '@/components/ui';
import { removalRequests } from '@/db/schema';
import { requirePermission } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { formatRome } from '@/lib/datetime';
import { m } from '@/lib/i18n';
import { handleRemoval } from '../actions';

export const metadata: Metadata = { title: m.admin.removals.title };

const DEADLINE_MS = 72 * 3_600_000;

// Richieste di rimozione (brief 13.6): foto o nome tolti entro 72 ore dalla richiesta.
export default async function RemovalsPage() {
  await requirePermission('removals.write');
  const rows = await (await getDb()).select().from(removalRequests).orderBy(desc(removalRequests.createdAt)).limit(100);
  const labels = m.admin.removals;
  const now = new Date().getTime();

  return (
    <>
      <AdminTitle title={labels.title} text={labels.text} />
      {rows.length === 0 ? (
        <p className="text-lg">{labels.empty}</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => {
            const due = new Date(row.createdAt.getTime() + DEADLINE_MS);
            const overdue = row.status === 'new' && due.getTime() < now;
            return (
              <li key={row.id} className={overdue ? 'card border-2 border-ink p-4' : 'card p-4'}>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={row.status === 'new' ? 'ink' : 'soft'}>{labels.statuses[row.status]}</Pill>
                  <span className="kicker text-xs text-muted">{m.legal.removal.subjects[row.subject]}</span>
                  {overdue ? <span className="kicker text-xs">{labels.overdue}</span> : null}
                </div>
                <p className="mt-2 break-words font-semibold">{row.reference}</p>
                {row.message ? <p className="mt-1 break-words text-muted">{row.message}</p> : null}
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">{labels.from}</dt>
                  <dd className="break-all">
                    <a href={`mailto:${row.contactEmail}`} className="font-semibold underline">
                      {row.contactEmail}
                    </a>
                  </dd>
                  <dt className="text-muted">{labels.received}</dt>
                  <dd>{formatRome(row.createdAt, 'dateTime')}</dd>
                  <dt className="text-muted">{labels.due}</dt>
                  <dd>{formatRome(due, 'dateTime')}</dd>
                </dl>
                {row.status === 'new' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionForm action={handleRemoval} submitLabel={labels.markDone} variant="outline">
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="status" value="done" />
                    </ActionForm>
                    <ActionForm action={handleRemoval} submitLabel={labels.markRejected} variant="quiet">
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="status" value="rejected" />
                    </ActionForm>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
