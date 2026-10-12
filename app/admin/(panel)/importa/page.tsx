import type { Metadata } from 'next';
import { ImportForm } from '@/components/admin/import-form';
import { AdminTitle, EditionSwitch, Panel } from '@/components/admin/ui';
import { workingEdition } from '@/lib/admin/action';
import { requirePermission } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { fmt, m } from '@/lib/i18n';

export const metadata: Metadata = { title: m.admin.import.title };

// Importazione CSV dei dati storici e di emergenza (brief 10): con anteprima prima di confermare.
export default async function ImportPage({ searchParams }: { searchParams: Promise<{ edizione?: string }> }) {
  await requirePermission('import.write');
  const { all, current } = await workingEdition(await getDb(), (await searchParams).edizione);
  const labels = m.admin.import;
  return (
    <div className="mx-auto max-w-3xl">
      <AdminTitle title={labels.title} text={labels.text} />
      <EditionSwitch years={all.map((edition) => edition.year)} current={current?.year ?? null} base="/admin/importa" />
      {current ? (
        <Panel title={current.name}>
          <ImportForm
            editionId={current.id}
            labels={labels}
            headers={[fmt(labels.line, { n: '' }).trim(), m.admin.common.date, m.admin.common.time, m.admin.matches.home, m.admin.matches.away, m.admin.result.title]}
          />
        </Panel>
      ) : (
        <p>{m.admin.today.noEdition}</p>
      )}
    </div>
  );
}
