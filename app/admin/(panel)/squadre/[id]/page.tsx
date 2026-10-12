import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/admin/action-form';
import { AdminTitle, EditionSwitch, Panel } from '@/components/admin/ui';
import { CheckboxField, inputClass, SelectField, TextField } from '@/components/form';
import { TeamCrest } from '@/components/team-crest';
import { competitions, groups, people, rosterEntries, stages, teamEntries, teams } from '@/db/schema';
import { CONSENT_STATUSES, PLAYER_ROLES, PUBLISH_NAME_MODES } from '@/db/schema/enums';
import { workingEdition } from '@/lib/admin/action';
import { requirePermission } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { fmt, m } from '@/lib/i18n';
import { BRAND } from '@/lib/tokens/brand';
import { publicPersonName } from '@/lib/people/display-name';
import { saveTeamCrest } from '../../foto/actions';
import { archiveTeam, removePlayer, saveEntry, savePlayer, saveTeam } from '../actions';

export const metadata: Metadata = { title: m.admin.teams.title };

const hiddenLabels = { withNumber: m.people.hiddenWithNumber, withoutNumber: m.people.hidden };

// Scheda squadra nel pannello: anagrafica, iscrizione all'edizione e rosa, con liberatoria e forma
// del nome per ogni persona (brief 9 e 13.6). Qui i nomi compaiono per esteso: è un'area riservata.
export default async function AdminTeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edizione?: string }> }) {
  await requirePermission('teams.write');
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const db = await getDb();
  const [team] = await db.select().from(teams).where(eq(teams.id, Number(id))).limit(1);
  if (!team) notFound();

  const { all, current } = await workingEdition(db, (await searchParams).edizione);
  const [entry] = current
    ? await db
        .select()
        .from(teamEntries)
        .where(and(eq(teamEntries.teamId, team.id), eq(teamEntries.editionId, current.id)))
        .limit(1)
    : [];
  const competitionIds = current ? (await db.select({ id: competitions.id }).from(competitions).where(eq(competitions.editionId, current.id))).map((row) => row.id) : [];
  const stageIds = competitionIds.length ? (await db.select({ id: stages.id }).from(stages).where(inArray(stages.competitionId, competitionIds))).map((row) => row.id) : [];
  const groupRows = stageIds.length ? await db.select().from(groups).where(inArray(groups.stageId, stageIds)).orderBy(asc(groups.order)) : [];
  const roster = entry
    ? await db
        .select({ roster: rosterEntries, person: people })
        .from(rosterEntries)
        .innerJoin(people, eq(people.id, rosterEntries.personId))
        .where(eq(rosterEntries.teamEntryId, entry.id))
        .orderBy(asc(rosterEntries.shirtNumber), asc(rosterEntries.id))
    : [];
  const labels = m.admin.teams;

  const playerFields = (prefix: string, values?: (typeof roster)[number]) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <TextField id={`${prefix}-firstName`} name="firstName" label={labels.firstName} required maxLength={60} defaultValue={values?.person.firstName} />
      <TextField id={`${prefix}-lastName`} name="lastName" label={labels.lastName} maxLength={60} defaultValue={values?.person.lastName} />
      <TextField id={`${prefix}-shirtNumber`} name="shirtNumber" label={labels.number} inputMode="numeric" maxLength={2} defaultValue={values?.roster.shirtNumber ?? ''} />
      <SelectField id={`${prefix}-role`} name="role" label={labels.role} defaultValue={values?.roster.role ?? ''}>
        <option value="">-</option>
        {PLAYER_ROLES.map((role) => (
          <option key={role} value={role}>
            {m.team.roles[role]}
          </option>
        ))}
      </SelectField>
      <SelectField id={`${prefix}-consentStatus`} name="consentStatus" label={labels.consent} defaultValue={values?.person.consentStatus ?? 'pending'}>
        {CONSENT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {labels.consents[status]}
          </option>
        ))}
      </SelectField>
      <SelectField id={`${prefix}-publishNameMode`} name="publishNameMode" label={labels.mode} defaultValue={values?.person.publishNameMode ?? ''}>
        {values ? null : <option value="">-</option>}
        {PUBLISH_NAME_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {labels.modes[mode]}
          </option>
        ))}
      </SelectField>
      <div className="col-span-2 flex items-end">
        <CheckboxField id={`${prefix}-isMinor`} name="isMinor" label={labels.minor} defaultChecked={values?.person.isMinor ?? false} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <TeamCrest team={{ code: team.shortCode, kitColor: team.kitColor, crestId: team.crestMediaId }} size={64} />
        <AdminTitle title={team.name} text={current?.name} />
      </div>
      <EditionSwitch years={all.map((edition) => edition.year)} current={current?.year ?? null} base={`/admin/squadre/${team.id}`} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={labels.name}>
          <ActionForm action={saveTeam} submitLabel={m.admin.common.save} className="space-y-4" errorsFor={['name', 'shortCode']}>
            <input type="hidden" name="id" value={team.id} />
            <TextField id="name" label={labels.name} required maxLength={80} defaultValue={team.name} />
            <div className="grid grid-cols-2 gap-4">
              <TextField id="shortCode" label={labels.shortCode} required maxLength={3} defaultValue={team.shortCode} />
              <TextField id="kitColor" label={labels.kitColor} type="color" defaultValue={team.kitColor ?? BRAND.sky.toLowerCase()} />
            </div>
          </ActionForm>
          <ActionForm action={saveTeamCrest} submitLabel={labels.crest} variant="quiet" className="mt-5 border-t border-line pt-4">
            <input type="hidden" name="teamId" value={team.id} />
            <label className="block">
              <span className="mb-1.5 block font-semibold">{labels.crest}</span>
              <input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" required className="block w-full text-sm" />
              <span className="mt-1 block text-sm text-muted">{labels.crestHelp}</span>
            </label>
          </ActionForm>
          <ActionForm action={archiveTeam} submitLabel={team.archivedAt ? m.admin.common.restore : m.admin.common.archive} variant="quiet" className="mt-5 border-t border-line pt-4">
            <input type="hidden" name="id" value={team.id} />
            {team.archivedAt ? <input type="hidden" name="restore" value="1" /> : null}
            <p className="text-sm text-muted">{labels.archiveBlocked}</p>
          </ActionForm>
        </Panel>

        {current ? (
          <Panel title={fmt(labels.entry, { edition: current.name })}>
            <ActionForm action={saveEntry} submitLabel={entry ? m.admin.common.save : fmt(labels.enroll, { edition: String(current.year) })} className="space-y-4">
              <input type="hidden" name="teamId" value={team.id} />
              <input type="hidden" name="editionId" value={current.id} />
              <label className="block">
                <span className="mb-1.5 block font-semibold">{labels.group}</span>
                <select name="groupId" defaultValue={entry?.groupId ?? ''} className={inputClass}>
                  <option value="">{labels.noGroup}</option>
                  {groupRows.map((group) => (
                    <option key={group.id} value={group.id}>
                      {fmt(m.match.group, { group: group.name })}
                    </option>
                  ))}
                </select>
              </label>
              {entry ? (
                <label className="block">
                  <span className="mb-1.5 block font-semibold">{m.admin.common.status}</span>
                  <select name="status" defaultValue={entry.status === 'withdrawn' ? 'withdrawn' : 'confirmed'} className={inputClass}>
                    <option value="confirmed">{labels.enrolled}</option>
                    <option value="withdrawn">{labels.withdrawn}</option>
                  </select>
                </label>
              ) : null}
            </ActionForm>
          </Panel>
        ) : null}
      </div>

      {entry && current ? (
        <Panel title={fmt(labels.roster, { edition: String(current.year) })}>
          <p className="mb-4 text-sm text-muted">{m.team.rosterNote}</p>
          <ul className="space-y-4">
            {roster.map((row) => (
              <li key={row.roster.id} className="rounded-xl border border-line p-3">
                <p className="mb-3 text-sm font-semibold">{fmt(labels.shownAs, { name: publicPersonName(row.person, row.roster.shirtNumber, hiddenLabels).text })}</p>
                <ActionForm action={savePlayer} submitLabel={m.admin.common.save} variant="quiet">
                  <input type="hidden" name="entryId" value={entry.id} />
                  <input type="hidden" name="rosterId" value={row.roster.id} />
                  {playerFields(`p${row.roster.id}`, row)}
                </ActionForm>
                <ActionForm action={removePlayer} submitLabel={m.admin.common.delete} variant="quiet" confirmText={`${m.admin.common.delete}?`}>
                  <input type="hidden" name="rosterId" value={row.roster.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="mb-3 text-xl">{labels.addPlayer}</h3>
            <ActionForm action={savePlayer} submitLabel={m.admin.common.add} variant="outline">
              <input type="hidden" name="entryId" value={entry.id} />
              {playerFields('nuovo')}
            </ActionForm>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
