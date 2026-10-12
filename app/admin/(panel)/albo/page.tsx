import { asc, desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { SelectField, TextField } from '@/components/form';
import { editions, honours, teams } from '@/db/schema';
import { requirePermission } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { m } from '@/lib/i18n';
import { deleteHonour, saveHonour } from '../actions';

export const metadata: Metadata = { title: m.admin.hall.title };

// Albo d'oro (brief 7.8): dove ci sono le partite si compila da solo; qui si inseriscono a mano
// le edizioni di cui si conosce solo il vincitore.
export default async function AdminHallPage() {
  await requirePermission('hall.write');
  const db = await getDb();
  const editionRows = await db.select().from(editions).orderBy(desc(editions.year));
  const teamRows = await db.select().from(teams).orderBy(asc(teams.name));
  const rows = await db.select({ honour: honours, year: editions.year }).from(honours).innerJoin(editions, eq(editions.id, honours.editionId)).orderBy(desc(editions.year));
  const labels = m.admin.hall;
  const teamName = (id: number | null) => teamRows.find((team) => team.id === id)?.name ?? null;

  const teamSelect = (id: string, label: string) => (
    <SelectField id={id} label={label}>
      <option value="">-</option>
      {teamRows.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </SelectField>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <AdminTitle title={labels.title} text={labels.text} />
        <ul className="space-y-3">
          {rows.map(({ honour, year }) => (
            <li key={honour.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="kicker text-xs text-muted">
                  {year} · {honour.competitionType === 'cup' ? m.hall.cup : m.hall.supercup}
                </p>
                <p className="font-semibold">{teamName(honour.winnerTeamId) ?? honour.winnerName ?? '-'}</p>
              </div>
              <ActionForm action={deleteHonour} submitLabel={m.admin.common.delete} variant="quiet" confirmText={`${m.admin.common.delete}?`}>
                <input type="hidden" name="id" value={honour.id} />
              </ActionForm>
            </li>
          ))}
        </ul>
      </div>
      <Panel title={m.admin.common.add}>
        <ActionForm action={saveHonour} submitLabel={m.admin.common.save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <SelectField id="editionId" label={m.admin.common.edition} required>
              {editionRows.map((edition) => (
                <option key={edition.id} value={edition.id}>
                  {edition.year}
                </option>
              ))}
            </SelectField>
            <SelectField id="competitionType" label={labels.competition}>
              <option value="cup">{m.hall.cup}</option>
              <option value="supercup">{m.hall.supercup}</option>
            </SelectField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {teamSelect('winnerTeamId', labels.winner)}
            <TextField id="winnerName" label={`${labels.winner} (${m.admin.common.name.toLowerCase()})`} maxLength={80} />
            {teamSelect('runnerUpTeamId', labels.runnerUp)}
            <TextField id="runnerUpName" label={`${labels.runnerUp} (${m.admin.common.name.toLowerCase()})`} maxLength={80} />
            <TextField id="topScorerName" label={labels.topScorer} help={m.stats.minorNote} maxLength={80} />
            <TextField id="topScorerGoals" label={labels.goals} inputMode="numeric" maxLength={3} />
          </div>
        </ActionForm>
      </Panel>
    </div>
  );
}
