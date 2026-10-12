import { and, desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/admin/action-form';
import { EventsEditor, type EditorTeam } from '@/components/admin/events-editor';
import { ScorePad } from '@/components/admin/score-pad';
import { adminLinkButton, Panel } from '@/components/admin/ui';
import { CheckboxField, inputClass } from '@/components/form';
import { StatusBadge } from '@/components/status-badge';
import { adminUsers, auditLog, matches } from '@/db/schema';
import type { MatchEventType } from '@/db/schema/enums';
import { adminEdition } from '@/lib/admin/data';
import { can } from '@/lib/auth/permissions';
import { requireUser } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { formatRome, romeDateKey, romeTimeKey } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';
import { archiveMatch, saveSchedule, setMatchStatus, undoMatch } from '../actions';

export const metadata: Metadata = { title: m.admin.result.title };

const EVENT_LABELS: Record<MatchEventType, string> = { goal: m.matchPage.goal, own_goal: m.matchPage.ownGoal, yellow: m.matchPage.yellow, red: m.matchPage.red, mvp: m.matchPage.mvp };

function snapshotText(snapshot: Record<string, unknown> | null): string {
  if (!snapshot) return '';
  const score = snapshot.homeScore !== null && snapshot.homeScore !== undefined ? `${snapshot.homeScore}-${snapshot.awayScore}` : '';
  const pens = snapshot.homePens !== null && snapshot.homePens !== undefined ? ` (${snapshot.homePens}-${snapshot.awayPens})` : '';
  const status = typeof snapshot.status === 'string' && snapshot.status in m.status ? m.status[snapshot.status as keyof typeof m.status] : '';
  return [score + pens, typeof status === 'string' ? status : ''].filter(Boolean).join(' · ');
}

// Scheda di una partita nel pannello: punteggio, stato, orario, cronaca e cronologia delle modifiche.
export default async function AdminMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const db = await getDb();
  const [row] = await db.select().from(matches).where(eq(matches.id, Number(id))).limit(1);
  if (!row) notFound();
  const loaded = await adminEdition(db, row.editionId);
  const match = loaded?.bundle.matches.find((item) => item.id === row.id);
  if (!loaded || !match) notFound();

  const { raw, bundle } = loaded;
  const canWrite = can(user.role, 'results.write');
  const stage = raw.stages.find((item) => item.id === row.stageId);
  const homeName = match.home?.name ?? match.homePlaceholder ?? m.match.toBeDecided;
  const awayName = match.away?.name ?? match.awayPlaceholder ?? m.match.toBeDecided;
  const bothTeams = match.home !== null && match.away !== null;
  const hidden = (
    <>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="version" value={row.version} />
    </>
  );

  // Nel pannello i nomi compaiono per esteso: servono a chi inserisce i marcatori.
  const editorTeams: EditorTeam[] = [match.home, match.away].flatMap((team) =>
    team
      ? [
          {
            entryId: team.entryId,
            name: team.name,
            players: raw.rosters
              .filter((item) => item.roster.teamEntryId === team.entryId)
              .map((item) => ({ rosterId: item.roster.id, label: `${item.roster.shirtNumber ?? '-'} · ${item.person.firstName} ${item.person.lastName}` })),
          },
        ]
      : [],
  );
  const initialEvents = raw.events
    .filter((item) => item.event.matchId === row.id)
    .map((item) => ({ type: item.event.type, minute: item.event.minute, teamEntryId: item.event.teamEntryId, rosterEntryId: item.event.rosterEntryId }));

  const history = await db
    .select({ entry: auditLog, userName: adminUsers.name })
    .from(auditLog)
    .leftJoin(adminUsers, eq(adminUsers.id, auditLog.userId))
    .where(and(eq(auditLog.entity, 'match'), eq(auditLog.entityId, String(row.id))))
    .orderBy(desc(auditLog.id))
    .limit(12);

  const forfeitScore = `${bundle.edition.config.forfeit.winner_score}-${bundle.edition.config.forfeit.loser_score}`;
  const summary = 'kicker flex min-h-12 cursor-pointer list-none items-center rounded-full border-2 border-ink px-4 text-sm [&::-webkit-details-marker]:hidden';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="kicker text-xs text-muted">
            {bundle.edition.name} · {match.label}
          </p>
          <h1 className="text-3xl">
            {homeName} <span className="text-muted">-</span> {awayName}
          </h1>
          <p className="mt-1 text-muted">
            {match.kickoffAt ? `${formatRome(match.kickoffAt, 'dayLong')}, ${formatRome(match.kickoffAt, 'time')}` : m.match.timeTbd}
            {match.fieldName ? ` · ${match.fieldName}` : ''}
          </p>
        </div>
        <StatusBadge status={match.status} />
      </div>

      {!canWrite ? <p className="rounded-xl bg-surface-2 p-3 font-semibold">{m.admin.common.readOnly}</p> : null}

      {canWrite ? (
        <Panel title={m.admin.result.title}>
          {bothTeams ? (
            <ScorePad
              match={{ id: row.id, version: row.version, status: row.status, homeScore: row.homeScore, awayScore: row.awayScore, homePens: row.homePens, awayPens: row.awayPens, knockout: stage?.kind !== 'group' }}
              homeName={homeName}
              awayName={awayName}
              labels={m.admin.result}
            />
          ) : (
            <p className="font-semibold">{m.admin.result.teamsMissing}</p>
          )}
        </Panel>
      ) : null}

      {canWrite ? (
        <Panel title={m.admin.result.statusTitle}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(['scheduled', 'cancelled'] as const).map((next) => (
                <ActionForm key={next} action={setMatchStatus} submitLabel={next === 'scheduled' ? m.admin.result.setScheduled : m.admin.result.setCancelled} variant="quiet">
                  {hidden}
                  <input type="hidden" name="next" value={next} />
                </ActionForm>
              ))}
            </div>

            <details className="group">
              <summary className={summary}>{m.admin.result.setPostponed}</summary>
              <ActionForm action={setMatchStatus} submitLabel={m.admin.result.setPostponed} variant="outline" className="mt-3 space-y-3 rounded-xl bg-surface-2 p-3">
                {hidden}
                <input type="hidden" name="next" value="postponed" />
                <label className="block">
                  <span className="mb-1.5 block font-semibold">{m.admin.result.postponeNote}</span>
                  <input name="note" className={inputClass} maxLength={160} />
                </label>
                <CheckboxField id="announce" label={m.admin.result.postponeNotice} defaultChecked />
              </ActionForm>
            </details>

            {bothTeams ? (
              <details className="group">
                <summary className={summary}>{m.admin.result.setForfeit}</summary>
                <div className="mt-3 space-y-2 rounded-xl bg-surface-2 p-3">
                  <p className="font-semibold">{m.admin.result.forfeitWho}</p>
                  <p className="text-sm text-muted">{fmt(m.admin.result.forfeitHelp, { score: forfeitScore })}</p>
                  <div className="flex flex-wrap gap-2">
                    {(['forfeit_home', 'forfeit_away'] as const).map((next) => (
                      <ActionForm key={next} action={setMatchStatus} submitLabel={fmt(m.admin.result.forfeitWinner, { team: next === 'forfeit_home' ? homeName : awayName })} variant="outline">
                        {hidden}
                        <input type="hidden" name="next" value={next} />
                      </ActionForm>
                    ))}
                  </div>
                </div>
              </details>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {canWrite ? (
        <Panel title={m.admin.result.schedule}>
          <ActionForm action={saveSchedule} submitLabel={m.admin.common.save} variant="outline">
            {hidden}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block font-semibold">{m.admin.common.date}</span>
                <input type="date" name="date" defaultValue={row.kickoffAt ? romeDateKey(row.kickoffAt) : ''} className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-semibold">{m.admin.common.time}</span>
                <input type="time" name="time" defaultValue={row.kickoffAt ? romeTimeKey(row.kickoffAt) : ''} className={inputClass} />
              </label>
              <label className="col-span-2 block sm:col-span-1">
                <span className="mb-1.5 block font-semibold">{m.admin.result.field}</span>
                <select name="fieldId" defaultValue={row.fieldId ?? ''} className={inputClass}>
                  <option value="">{m.admin.common.none}</option>
                  {raw.fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </ActionForm>
        </Panel>
      ) : null}

      {canWrite && bothTeams ? (
        <Panel title={m.admin.result.events}>
          <p className="mb-3 text-sm text-muted">{m.admin.result.eventsHelp}</p>
          <EventsEditor initial={initialEvents} teams={editorTeams} labels={m.admin.result} typeLabels={EVENT_LABELS} matchId={row.id} version={row.version} saveLabel={m.admin.common.save} />
        </Panel>
      ) : null}

      <Panel title={m.admin.result.history}>
        {history.length === 0 ? (
          <p className="text-muted">{m.admin.result.historyEmpty}</p>
        ) : (
          <ol className="divide-y divide-line">
            {history.map(({ entry, userName }) => (
              <li key={entry.id} className="py-2 text-sm">
                <p className="font-semibold">{fmt(m.admin.result.historyBy, { who: userName ?? m.admin.result.historySystem, when: formatRome(entry.at, 'dateTime') })}</p>
                <p className="text-muted">
                  {entry.action === 'events' ? m.admin.result.events : [snapshotText(entry.before), snapshotText(entry.after)].filter(Boolean).join(' → ')}
                </p>
              </li>
            ))}
          </ol>
        )}
        {canWrite && history.some(({ entry }) => entry.action === 'update') ? (
          <ActionForm action={undoMatch} submitLabel={m.admin.result.undo} variant="quiet" className="mt-3">
            <input type="hidden" name="id" value={row.id} />
          </ActionForm>
        ) : null}
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/edizioni/${bundle.edition.year}/partite/${row.id}`} className={adminLinkButton}>
          {m.admin.result.publicPage}
        </Link>
        {can(user.role, 'calendar.write') ? (
          <ActionForm action={archiveMatch} submitLabel={m.admin.common.archive} variant="quiet" confirmText={m.admin.matches.archiveConfirm} className="[&>div]:mt-0">
            <input type="hidden" name="id" value={row.id} />
          </ActionForm>
        ) : null}
      </div>
    </div>
  );
}
