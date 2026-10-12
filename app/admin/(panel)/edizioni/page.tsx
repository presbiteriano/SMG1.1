import { desc } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/admin/action-form';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { TextField } from '@/components/form';
import { Pill } from '@/components/ui';
import { editions } from '@/db/schema';
import { requirePermission } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { m } from '@/lib/i18n';
import { createEdition } from './actions';

export const metadata: Metadata = { title: m.admin.editions.title };

export default async function AdminEditionsPage() {
  await requirePermission('editions.write');
  const rows = await (await getDb()).select().from(editions).orderBy(desc(editions.year));
  const labels = m.admin.editions;
  const nextYear = (rows[0]?.year ?? new Date().getFullYear()) + 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        <AdminTitle title={labels.title} />
        {rows.length === 0 ? (
          <p className="text-lg">{labels.empty}</p>
        ) : (
          <ul className="card divide-y divide-line">
            {rows.map((edition) => (
              <li key={edition.id}>
                <Link href={`/admin/edizioni/${edition.id}`} className="flex min-h-16 items-center gap-4 px-4 py-2 hover:bg-surface-2">
                  <span className="display text-4xl tabular-nums">{edition.year}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{edition.name}</span>
                  <Pill tone={edition.status === 'live' ? 'ink' : edition.status === 'draft' ? 'outline' : 'soft'}>{m.status.edition[edition.status]}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Panel title={labels.new}>
        <p className="mb-4 text-sm text-muted">{labels.newHelp}</p>
        <ActionForm action={createEdition} submitLabel={m.admin.common.create} className="space-y-4">
          <TextField id="year" label={labels.year} inputMode="numeric" required maxLength={4} defaultValue={nextYear} />
          <TextField id="name" label={labels.name} required maxLength={80} defaultValue={`${m.brand.name} ${nextYear}`} />
        </ActionForm>
      </Panel>
    </div>
  );
}
