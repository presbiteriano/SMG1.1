import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { TextAreaField, TextField } from '@/components/form';
import { workingEdition } from '@/lib/admin/action';
import { requirePermission } from '@/lib/auth/session';
import { safeEditionConfig } from '@/lib/config/edition-config';
import { getDb } from '@/lib/data/db';
import { fmt, m } from '@/lib/i18n';
import { generateCalendar } from './actions';

export const metadata: Metadata = { title: m.admin.generator.title };

export default async function GeneratorPage({ searchParams }: { searchParams: Promise<{ edizione?: string }> }) {
  await requirePermission('calendar.write');
  const { current } = await workingEdition(await getDb(), (await searchParams).edizione);
  if (!current) return <p>{m.admin.today.noEdition}</p>;
  const config = safeEditionConfig(current.config);
  const labels = m.admin.generator;

  return (
    <div className="mx-auto max-w-2xl">
      <AdminTitle title={labels.title} text={labels.text} />
      <Panel title={current.name}>
        <p className="mb-4 text-muted">{fmt(m.hub.formatText, { groups: config.groups, qualify: config.qualify_per_group })}</p>
        <ActionForm action={generateCalendar} submitLabel={labels.submit} className="space-y-4">
          <input type="hidden" name="editionId" value={current.id} />
          <TextAreaField id="evenings" label={labels.evenings} help={labels.eveningsHelp} rows={6} required />
          <TextAreaField id="knockoutEvenings" label={labels.knockoutEvenings} help={labels.knockoutHelp} rows={3} />
          <TextField id="slots" label={labels.slots} help={labels.slotsHelp} defaultValue={config.schedule.slot_times.join(', ')} />
          <p className="text-sm text-muted">{labels.assignHelp}</p>
        </ActionForm>
      </Panel>
    </div>
  );
}
