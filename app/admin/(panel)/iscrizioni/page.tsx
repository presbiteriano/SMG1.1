import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { adminLinkButton, AdminTitle, EditionSwitch } from '@/components/admin/ui';
import { CheckboxField, inputClass } from '@/components/form';
import { Pill } from '@/components/ui';
import { registrations } from '@/db/schema';
import { REGISTRATION_STATUSES } from '@/db/schema/enums';
import { workingEdition } from '@/lib/admin/action';
import { can } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/session';
import { safeEditionConfig } from '@/lib/config/edition-config';
import { phoneHref } from '@/lib/config/site-settings';
import { getDb } from '@/lib/data/db';
import { formatRome } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';
import { updateRegistration } from '../actions';

export const metadata: Metadata = { title: m.admin.registrations.title };

// Iscrizioni ricevute (brief 9): stato, note interne, esportazione CSV. Contengono i contatti dei
// referenti: si vedono solo qui dentro e si cancellano 12 mesi dopo la fine dell'edizione.
export default async function RegistrationsPage({ searchParams }: { searchParams: Promise<{ edizione?: string }> }) {
  const user = await requirePermission('registrations.read');
  const db = await getDb();
  const { all, current } = await workingEdition(db, (await searchParams).edizione);
  const rows = current ? await db.select().from(registrations).where(eq(registrations.editionId, current.id)).orderBy(desc(registrations.createdAt)) : [];
  const labels = m.admin.registrations;
  const canWrite = can(user.role, 'registrations.write');
  const capacity = current ? safeEditionConfig(current.config).registration.capacity : null;
  const accepted = rows.filter((row) => row.status === 'accepted').length;
  const waitlist = rows.filter((row) => row.status === 'waitlist').length;

  return (
    <>
      <AdminTitle title={labels.title} text={current ? (capacity ? fmt(labels.capacity, { accepted, total: capacity, waitlist }) : fmt(labels.capacityOpen, { accepted, waitlist })) : undefined}>
        {current && can(user.role, 'export.read') ? (
          <a href={`/api/admin/export/iscrizioni?edizione=${current.year}`} className={adminLinkButton}>
            {m.admin.common.exportCsv}
          </a>
        ) : null}
      </AdminTitle>
      <EditionSwitch years={all.map((edition) => edition.year)} current={current?.year ?? null} base="/admin/iscrizioni" />
      {!canWrite ? <p className="mb-4 rounded-xl bg-surface-2 p-3 font-semibold">{m.admin.common.readOnly}</p> : null}

      {rows.length === 0 ? (
        <p className="text-lg">{labels.empty}</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xl font-semibold break-words">{row.teamName}</p>
                <Pill tone={row.status === 'new' ? 'ink' : row.status === 'accepted' ? 'sky' : 'soft'}>{labels.statuses[row.status]}</Pill>
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">{labels.contact}</dt>
                <dd className="font-semibold">{row.contactName}</dd>
                <dt className="text-muted">{m.registration.phone}</dt>
                <dd>
                  <a href={phoneHref(row.contactPhone)} className="font-semibold underline">
                    {row.contactPhone}
                  </a>
                </dd>
                <dt className="text-muted">{m.registration.email}</dt>
                <dd className="break-all">
                  <a href={`mailto:${row.contactEmail}`} className="font-semibold underline">
                    {row.contactEmail}
                  </a>
                </dd>
                <dt className="text-muted">{labels.players}</dt>
                <dd>
                  {row.playersCount ?? '-'}
                  {row.hasMinors ? ` · ${labels.minors}` : ''}
                </dd>
                <dt className="text-muted">{labels.received}</dt>
                <dd>{formatRome(row.createdAt, 'dateTime')}</dd>
                {row.notes ? (
                  <>
                    <dt className="text-muted">{m.admin.common.notes}</dt>
                    <dd>{row.notes}</dd>
                  </>
                ) : null}
              </dl>

              {canWrite ? (
                <ActionForm action={updateRegistration} submitLabel={m.admin.common.save} variant="quiet" className="mt-3 space-y-3 border-t border-line pt-3">
                  <input type="hidden" name="id" value={row.id} />
                  <label className="block">
                    <span className="mb-1 block text-sm font-semibold">{m.admin.common.status}</span>
                    <select name="status" defaultValue={row.status} className={inputClass}>
                      {REGISTRATION_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {labels.statuses[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-semibold">{labels.internal}</span>
                    <textarea name="internalNotes" defaultValue={row.internalNotes ?? ''} rows={2} maxLength={1000} className={`${inputClass} py-2`} />
                  </label>
                  {row.teamId ? <p className="text-sm font-semibold">{labels.teamLinked}</p> : <CheckboxField id={`createTeam-${row.id}`} name="createTeam" label={labels.createTeam} />}
                </ActionForm>
              ) : row.internalNotes ? (
                <p className="mt-3 border-t border-line pt-3 text-sm">{row.internalNotes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
