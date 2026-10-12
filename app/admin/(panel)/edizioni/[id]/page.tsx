import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/admin/action-form';
import { TiebreakerOrder } from '@/components/admin/tiebreaker-order';
import { adminLinkButton, AdminTitle, Panel } from '@/components/admin/ui';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/form';
import { editions } from '@/db/schema';
import { EDITION_STATUSES } from '@/db/schema/enums';
import { requirePermission } from '@/lib/auth/session';
import { safeEditionConfig, TIEBREAKERS } from '@/lib/config/edition-config';
import { getDb } from '@/lib/data/db';
import { romeDateKey } from '@/lib/datetime';
import { m } from '@/lib/i18n';
import { saveEdition } from '../actions';

export const metadata: Metadata = { title: m.admin.editions.title };

// Regole dell'edizione (brief 1 e 11.3): punti, spareggi, gironi, qualificate, orari, quota.
// Quando il titolare risponde alle domande della sezione 15 si cambia un valore qui, non il programma.
export default async function AdminEditionPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('editions.write');
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const [edition] = await (await getDb()).select().from(editions).where(eq(editions.id, Number(id))).limit(1);
  if (!edition) notFound();
  const config = safeEditionConfig(edition.config);
  const labels = m.admin.editions;
  // I punti restano sempre il primo criterio: qui si ordinano gli spareggi che vengono dopo.
  const order = [...config.tiebreakers, ...TIEBREAKERS.filter((criterion) => !config.tiebreakers.includes(criterion))].filter((criterion) => criterion !== 'points');
  const names = Object.fromEntries(TIEBREAKERS.map((criterion) => [criterion, m.standings.criteriaShort[criterion]]));
  const number = (name: string, label: string, value: number | null, max = 2) => <TextField id={name} label={label} inputMode="numeric" maxLength={max} defaultValue={value ?? ''} />;

  return (
    <div className="mx-auto max-w-3xl">
      <AdminTitle title={edition.name}>
        <a href={`/api/admin/export/partite?edizione=${edition.year}`} className={adminLinkButton}>
          {m.admin.common.exportCsv}
        </a>
      </AdminTitle>
      <ActionForm action={saveEdition} submitLabel={m.admin.common.save} className="space-y-6">
        <input type="hidden" name="id" value={edition.id} />

        <Panel title={labels.title}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="name" label={labels.name} required maxLength={80} defaultValue={edition.name} />
            <SelectField id="status" label={labels.status} help={labels.statusHelp} defaultValue={edition.status}>
              {EDITION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {m.status.edition[status]}
                </option>
              ))}
            </SelectField>
            <TextField id="startDate" label={labels.start} type="date" defaultValue={edition.startDate ?? ''} />
            <TextField id="endDate" label={labels.end} type="date" defaultValue={edition.endDate ?? ''} />
            <TextField id="registrationOpen" label={labels.regOpen} type="date" defaultValue={edition.registrationOpenAt ? romeDateKey(edition.registrationOpenAt) : ''} />
            <TextField id="registrationClose" label={labels.regClose} type="date" defaultValue={edition.registrationCloseAt ? romeDateKey(edition.registrationCloseAt) : ''} />
          </div>
        </Panel>

        <Panel title={labels.rulesSection}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {number('pointsWin', labels.pointsWin, config.points.win)}
            {number('pointsDraw', labels.pointsDraw, config.points.draw)}
            {number('pointsLoss', labels.pointsLoss, config.points.loss)}
            {number('groups', labels.groups, config.groups)}
            {number('qualify', labels.qualify, config.qualify_per_group)}
          </div>
          <fieldset className="mt-5">
            <legend className="mb-1 font-semibold">{labels.tiebreakers}</legend>
            <p className="mb-2 text-sm text-muted">{labels.tiebreakersHelp}</p>
            <TiebreakerOrder initial={order} names={names} moveUp={labels.moveUp} moveDown={labels.moveDown} />
          </fieldset>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {number('fairYellow', labels.fairYellow, config.fair_play.yellow)}
            {number('fairRed', labels.fairRed, config.fair_play.red)}
            {number('forfeitWin', labels.forfeitWin, config.forfeit.winner_score)}
            {number('forfeitLoss', labels.forfeitLoss, config.forfeit.loser_score)}
          </div>
        </Panel>

        <Panel title={m.hub.format}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {number('playersOnField', labels.playersOnField, config.format.players_on_field)}
            {number('halves', labels.halves, config.format.halves, 1)}
            {number('halfMinutes', labels.halfMinutes, config.format.half_minutes)}
            {number('matchMinutes', labels.matchMinutes, config.schedule.match_minutes, 3)}
            <TextField id="slotTimes" label={labels.slotTimes} defaultValue={config.schedule.slot_times.join(', ')} className="col-span-2" />
          </div>
        </Panel>

        <Panel title={m.nav.register}>
          <div className="space-y-4">
            {number('capacity', labels.capacity, config.registration.capacity, 3)}
            <TextField id="feeText" label={labels.feeText} maxLength={300} defaultValue={config.registration.fee_text} />
            <TextAreaField id="paymentText" label={labels.paymentText} maxLength={600} rows={3} defaultValue={config.registration.payment_text} />
            <TextField id="rulesUrl" label={labels.rulesUrl} defaultValue={edition.rulesUrl ?? ''} placeholder="https://" />
          </div>
        </Panel>

        <Panel title={labels.features}>
          <CheckboxField id="featureStats" label={labels.featureStats} defaultChecked={config.features.stats} />
          <CheckboxField id="featureRosters" label={labels.featureRosters} defaultChecked={config.features.rosters} />
          <div className="mt-4">
            <TextField id="tuttocampoUrl" label={labels.tuttocampo} help={labels.tuttocampoHelp} type="url" placeholder="https://" defaultValue={config.links.tuttocampo_url ?? ''} />
          </div>
        </Panel>
      </ActionForm>
    </div>
  );
}
