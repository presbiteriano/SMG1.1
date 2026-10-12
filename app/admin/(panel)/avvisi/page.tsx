import { desc } from 'drizzle-orm';
import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { SelectField, TextAreaField, TextField } from '@/components/form';
import { Pill } from '@/components/ui';
import { announcements } from '@/db/schema';
import { SEVERITIES } from '@/db/schema/enums';
import { workingEdition } from '@/lib/admin/action';
import { requirePermission } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { formatRome } from '@/lib/datetime';
import { m } from '@/lib/i18n';
import { endAnnouncement, publishAnnouncement } from '../actions';

export const metadata: Metadata = { title: m.admin.announcements.title };

// Avvisi (brief 8): gravità, validità nel tempo e collegamento. Compaiono in cima a ogni pagina.
export default async function AnnouncementsPage() {
  await requirePermission('announcements.write');
  const db = await getDb();
  const { current } = await workingEdition(db, null);
  const rows = await db.select().from(announcements).orderBy(desc(announcements.startsAt)).limit(40);
  const now = new Date().getTime();
  const labels = m.admin.announcements;
  const stateOf = (row: (typeof rows)[number]) => (row.startsAt.getTime() > now ? 'future' : row.endsAt && row.endsAt.getTime() <= now ? 'expired' : 'active');

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <AdminTitle title={labels.new} />
        <Panel>
          <ActionForm action={publishAnnouncement} submitLabel={labels.publish} className="space-y-4">
            {current ? <input type="hidden" name="editionId" value={current.id} /> : null}
            <TextField id="title" label={labels.titleField} required maxLength={120} />
            <TextAreaField id="body" label={labels.body} rows={3} maxLength={400} optionalLabel={m.common.optional} />
            <div className="grid grid-cols-2 gap-4">
              <SelectField id="severity" label={labels.severity} defaultValue="warning">
                {SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {m.announcement[severity]}
                  </option>
                ))}
              </SelectField>
              <SelectField id="duration" label={labels.duration} defaultValue="day">
                {(Object.keys(labels.durations) as (keyof typeof labels.durations)[]).map((key) => (
                  <option key={key} value={key}>
                    {labels.durations[key]}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextField id="link" label={labels.link} placeholder="/edizioni/2027/calendario" maxLength={300} />
          </ActionForm>
        </Panel>
      </div>

      <div>
        <AdminTitle title={labels.title} />
        {rows.length === 0 ? (
          <p className="text-muted">{labels.empty}</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const state = stateOf(row);
              return (
                <li key={row.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={state === 'active' ? 'ink' : state === 'future' ? 'sky' : 'soft'}>{labels[state]}</Pill>
                    <span className="kicker text-xs text-muted">{m.announcement[row.severity]}</span>
                  </div>
                  <p className="mt-2 font-semibold">{row.title}</p>
                  {row.body ? <p className="text-muted">{row.body}</p> : null}
                  <p className="mt-1 text-sm text-muted">
                    {formatRome(row.startsAt, 'dateTime')} → {row.endsAt ? formatRome(row.endsAt, 'dateTime') : '∞'}
                  </p>
                  {state !== 'expired' ? (
                    <ActionForm action={endAnnouncement} submitLabel={labels.end} variant="quiet">
                      <input type="hidden" name="id" value={row.id} />
                    </ActionForm>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
