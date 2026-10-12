import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { SelectField, TextField } from '@/components/form';
import { workingEdition } from '@/lib/admin/action';
import { adminEdition } from '@/lib/admin/data';
import { requirePermission } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { fmt, m } from '@/lib/i18n';
import { createMatch } from '../actions';

export const metadata: Metadata = { title: m.admin.matches.new };

export default async function NewMatchPage({ searchParams }: { searchParams: Promise<{ edizione?: string }> }) {
  await requirePermission('calendar.write');
  const db = await getDb();
  const { current } = await workingEdition(db, (await searchParams).edizione);
  const loaded = current ? await adminEdition(db, current.id) : null;
  if (!current || !loaded) return <p>{m.admin.today.noEdition}</p>;
  const { raw, bundle } = loaded;
  const labels = m.admin.matches;

  return (
    <div className="mx-auto max-w-2xl">
      <AdminTitle title={labels.new} text={current.name} />
      <Panel>
        {raw.stages.length === 0 ? (
          <p className="font-semibold">{m.admin.matches.empty}</p>
        ) : (
          <ActionForm action={createMatch} submitLabel={m.admin.common.create} className="space-y-4">
            <input type="hidden" name="editionId" value={current.id} />
            <SelectField id="stage" label={labels.stage} required>
              {raw.competitions.flatMap((competition) =>
                raw.stages
                  .filter((stage) => stage.competitionId === competition.id)
                  .map((stage) => (
                    <option key={stage.id} value={`${competition.id}:${stage.id}`}>
                      {competition.name} · {stage.name}
                    </option>
                  )),
              )}
            </SelectField>
            <div className="grid grid-cols-2 gap-4">
              <SelectField id="groupId" label={labels.group} optionalLabel={m.common.optional}>
                <option value="">{m.admin.common.none}</option>
                {raw.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {fmt(m.match.group, { group: group.name })}
                  </option>
                ))}
              </SelectField>
              <TextField id="round" label={labels.round} optionalLabel={m.common.optional} inputMode="numeric" maxLength={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['homeEntryId', 'awayEntryId'] as const).map((name) => (
                <SelectField key={name} id={name} label={name === 'homeEntryId' ? labels.home : labels.away}>
                  <option value="">{labels.tbd}</option>
                  {bundle.teams.map((team) => (
                    <option key={team.entryId} value={team.entryId}>
                      {team.name}
                      {team.groupName ? ` (${team.groupName})` : ''}
                    </option>
                  ))}
                </SelectField>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <TextField id="date" label={m.admin.common.date} type="date" />
              <TextField id="time" label={m.admin.common.time} type="time" />
              <SelectField id="fieldId" label={m.admin.result.field} className="col-span-2 sm:col-span-1">
                <option value="">{m.admin.common.none}</option>
                {raw.fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </SelectField>
            </div>
          </ActionForm>
        )}
      </Panel>
    </div>
  );
}
