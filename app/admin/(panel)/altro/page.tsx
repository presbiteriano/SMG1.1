import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminTitle } from '@/components/admin/ui';
import { adminLinks } from '@/lib/admin/nav';
import { requireUser } from '@/lib/auth/session';
import { m } from '@/lib/i18n';

export const metadata: Metadata = { title: m.admin.nav.more };

// Su telefono la barra in basso ha quattro voci: tutte le altre sezioni si raggiungono da qui.
export default async function MorePage() {
  const user = await requireUser();
  return (
    <>
      <AdminTitle title={m.admin.nav.more} />
      <ul className="card divide-y divide-line">
        {adminLinks(user.role).map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="flex min-h-14 items-center justify-between gap-3 px-4 text-lg font-semibold hover:bg-surface-2">
              {link.label}
              <ChevronRight aria-hidden className="size-5 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
