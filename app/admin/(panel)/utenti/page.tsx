import { asc } from 'drizzle-orm';
import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { CheckboxField, inputClass, SelectField, TextField } from '@/components/form';
import { adminUsers } from '@/db/schema';
import { ADMIN_ROLES } from '@/db/schema/enums';
import { requirePermission } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { formatRome } from '@/lib/datetime';
import { m } from '@/lib/i18n';
import { saveUser } from '../actions';

export const metadata: Metadata = { title: m.admin.users.title };

// Utenti del pannello (brief 9): titolare, redazione, sola lettura. Niente password: si entra con un link via email.
export default async function UsersPage() {
  const me = await requirePermission('users.write');
  const rows = await (await getDb()).select().from(adminUsers).orderBy(asc(adminUsers.name));
  const labels = m.admin.users;

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div>
        <AdminTitle title={labels.title} />
        <ul className="space-y-3">
          {rows.map((user) => (
            <li key={user.id} className="card p-4">
              <p className="font-semibold">
                {user.name}
                {user.id === me.id ? ' ★' : ''}
              </p>
              <p className="text-sm break-all text-muted">{user.email}</p>
              <p className="text-sm text-muted">
                {labels.lastLogin}: {user.lastLoginAt ? formatRome(user.lastLoginAt, 'dateTime') : labels.never}
              </p>
              <ActionForm action={saveUser} submitLabel={m.admin.common.save} variant="quiet" className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={user.id} />
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">{labels.role}</span>
                  <select name="role" defaultValue={user.role} className={inputClass}>
                    {ADMIN_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {m.admin.roles[role]}
                      </option>
                    ))}
                  </select>
                </label>
                <CheckboxField id={`active-${user.id}`} name="active" label={labels.active} defaultChecked={user.active} />
              </ActionForm>
            </li>
          ))}
        </ul>
      </div>
      <Panel title={labels.new}>
        <ActionForm action={saveUser} submitLabel={m.admin.common.create} className="space-y-4">
          <TextField id="name" label={labels.name} required maxLength={80} />
          <TextField id="email" label={labels.email} type="email" required maxLength={200} />
          <SelectField id="role" label={labels.role} defaultValue="editor">
            {ADMIN_ROLES.map((role) => (
              <option key={role} value={role}>
                {m.admin.roles[role]}
              </option>
            ))}
          </SelectField>
        </ActionForm>
      </Panel>
    </div>
  );
}
