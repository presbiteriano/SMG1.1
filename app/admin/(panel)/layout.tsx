import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/shell';
import { hasExampleData } from '@/db/seed/seed-example';
import { adminLinks } from '@/lib/admin/nav';
import { requireUser } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { m } from '@/lib/i18n';
import { logout } from '../(auth)/actions';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const example = await hasExampleData(await getDb());
  return (
    <AdminShell
      links={adminLinks(user.role)}
      userName={user.name}
      roleLabel={m.admin.roles[user.role]}
      labels={{ ...m.admin.nav, title: m.admin.title, exampleBadge: m.meta.exampleBadge }}
      logoutAction={logout}
      example={example}
    >
      {children}
    </AdminShell>
  );
}
