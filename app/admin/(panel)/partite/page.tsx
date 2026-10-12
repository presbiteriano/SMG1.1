import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/admin/action-form';
import { adminLinkButton, AdminMatchRow, AdminTitle, EditionSwitch, Panel } from '@/components/admin/ui';
import { inputClass } from '@/components/form';
import { workingEdition } from '@/lib/admin/action';
import { adminEdition } from '@/lib/admin/data';
import { can } from '@/lib/auth/permissions';
import { requireUser } from '@/lib/auth/session';
import { byKickoff } from '@/lib/bracket/view';
import { getDb } from '@/lib/data/db';
import type { MatchDTO } from '@/lib/data/dto';
import { dateKeyToInstant, formatRome, romeDateKey } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';
import { saveTiebreak } from '../actions';

export const metadata: Metadata = { title: m.admin.matches.title };

export default async function AdminMatchesPage({ searchParams }: { searchParams: Promise<{ edizione?: string }> }) {
  const user = await requireUser();
  const db = await getDb();
  const { all, current } = await workingEdition(db, (await searchParams).edizione);
  const loaded = current ? await adminEdition(db, current.id) : null;
  const matches = loaded ? [...loaded.bundle.matches].sort(byKickoff) : [];

  const tiedGroups = (loaded?.bundle.competitions ?? [])
    .flatMap((competition) => competition.stages.flatMap((stage) => stage.groups))
    .filter((group) => group.hasResults && !group.provisional && group.rows.some((row) => row.tied));

  const byDay = new Map<string, MatchDTO[]>();
  for (const match of matches) {
    const key = match.kickoffAt ? romeDateKey(match.kickoffAt) : '';
    byDay.set(key, [...(byDay.get(key) ?? []), match]);
  }

  return (
    <>
      <AdminTitle title={m.admin.matches.title} text={current?.name}>
        {current && can(user.role, 'calendar.write') ? (
          <>
            <Link href={`/admin/partite/nuova?edizione=${current.year}`} className={adminLinkButton}>
              {m.admin.matches.new}
            </Link>
            <Link href={`/admin/partite/genera?edizione=${current.year}`} className={adminLinkButton}>
              {m.admin.matches.generate}
            </Link>
          </>
        ) : null}
      </AdminTitle>
      <EditionSwitch years={all.map((edition) => edition.year)} current={current?.year ?? null} base="/admin/partite" />

      {/* Sorteggio: compare solo quando un girone è finito e i criteri non bastano a separare due squadre. */}
      {can(user.role, 'results.write')
        ? tiedGroups.map((group) => {
            const tied = group.rows.filter((row) => row.tied);
            return (
              <Panel key={group.id} title={m.admin.tiebreak.title} className="mb-5 border-2 border-ink">
                <p className="mb-3">{fmt(m.admin.tiebreak.text, { group: fmt(m.match.group, { group: group.name }) })}</p>
                <ActionForm action={saveTiebreak} submitLabel={m.admin.tiebreak.save} variant="outline" className="space-y-3">
                  <input type="hidden" name="groupId" value={group.id} />
                  {tied.map((row, index) => (
                    <label key={row.team.entryId} className="block">
                      <span className="mb-1 block text-sm font-semibold">{fmt(m.admin.tiebreak.position, { n: index + 1 })}</span>
                      <select name="order" defaultValue={row.team.entryId} className={inputClass}>
                        {tied.map((option) => (
                          <option key={option.team.entryId} value={option.team.entryId}>
                            {option.team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </ActionForm>
              </Panel>
            );
          })
        : null}

      {matches.length === 0 ? (
        <p className="text-lg">{m.admin.matches.empty}</p>
      ) : (
        <div className="space-y-7">
          {[...byDay.entries()].map(([day, dayMatches]) => (
            <section key={day || 'senza-data'}>
              <h2 className="mb-3 border-b-2 border-ink pb-1 text-2xl">{day ? formatRome(dateKeyToInstant(day), 'dayLong') : m.match.timeTbd}</h2>
              <ul className="grid gap-3 lg:grid-cols-2">
                {dayMatches.map((match) => (
                  <li key={match.id}>
                    <AdminMatchRow match={match} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
