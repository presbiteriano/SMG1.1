import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { AdminTitle, tableClass, tdClass, thClass } from '@/components/admin/ui';
import { adminUsers, auditLog } from '@/db/schema';
import { requirePermission } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { formatRome } from '@/lib/datetime';
import { m } from '@/lib/i18n';

export const metadata: Metadata = { title: m.admin.audit.title };

const compact = (value: Record<string, unknown> | null) => (value ? JSON.stringify(value).slice(0, 160) : '');

// Registro delle modifiche (brief 9): chi, quando, valore prima e dopo.
export default async function AuditPage() {
  await requirePermission('audit.read');
  const rows = await (await getDb())
    .select({ entry: auditLog, userName: adminUsers.name })
    .from(auditLog)
    .leftJoin(adminUsers, eq(adminUsers.id, auditLog.userId))
    .orderBy(desc(auditLog.id))
    .limit(150);
  const labels = m.admin.audit;

  return (
    <>
      <AdminTitle title={labels.title} text={labels.text} />
      {rows.length === 0 ? (
        <p>{labels.empty}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>
                  {labels.when}
                </th>
                <th scope="col" className={thClass}>
                  {labels.who}
                </th>
                <th scope="col" className={thClass}>
                  {labels.what}
                </th>
                <th scope="col" className={thClass}>
                  {labels.before}
                </th>
                <th scope="col" className={thClass}>
                  {labels.after}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry, userName }) => (
                <tr key={entry.id}>
                  <td className={`${tdClass} whitespace-nowrap`}>{formatRome(entry.at, 'dateTime')}</td>
                  <td className={tdClass}>{userName ?? labels.system}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {entry.entity} {entry.entityId} · {entry.action}
                  </td>
                  <td className={`${tdClass} font-mono text-xs break-all`}>{compact(entry.before)}</td>
                  <td className={`${tdClass} font-mono text-xs break-all`}>{compact(entry.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
