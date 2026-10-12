import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/admin/action-form';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { EXAMPLE_PHASES, hasExampleData } from '@/db/seed/seed-example';
import { requirePermission } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { isProduction } from '@/lib/env';
import { m } from '@/lib/i18n';
import { clearExample, loadExample } from '../actions';

export const metadata: Metadata = { title: m.admin.example.title };

// Dati di esempio (brief, sezione 18): per provare il sito e fare la prova generale con una serata
// simulata. In produzione questa pagina non esiste.
export default async function ExamplePage() {
  await requirePermission('example.write');
  if (isProduction()) notFound();
  const present = await hasExampleData(await getDb());
  const labels = m.admin.example;

  return (
    <div className="mx-auto max-w-3xl">
      <AdminTitle title={labels.title} text={labels.text} />
      <p className="mb-5 rounded-xl border-2 border-dashed border-ink p-3 font-semibold">{labels.warning}</p>
      <ul className="space-y-3">
        {EXAMPLE_PHASES.map((phase) => (
          <li key={phase}>
            <Panel>
              <p className="display text-2xl">{labels.phases[phase]}</p>
              <p className="mt-1 text-muted">{labels.phaseHelp[phase]}</p>
              <ActionForm action={loadExample} submitLabel={labels.load} pendingLabel={m.admin.common.saving} variant="outline">
                <input type="hidden" name="phase" value={phase} />
              </ActionForm>
            </Panel>
          </li>
        ))}
      </ul>
      {present ? (
        <Panel className="mt-6">
          <p className="font-semibold">{labels.present}</p>
          <ActionForm action={clearExample} submitLabel={labels.purge} variant="quiet" confirmText={`${labels.purge}?`} />
        </Panel>
      ) : null}
    </div>
  );
}
