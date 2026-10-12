import { asc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/admin/action-form';
import { AdminTitle, EditionSwitch, Panel } from '@/components/admin/ui';
import { TextField } from '@/components/form';
import { Pill } from '@/components/ui';
import { groups, teamEntries, teams } from '@/db/schema';
import { workingEdition } from '@/lib/admin/action';
import { requirePermission } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { fmt, m } from '@/lib/i18n';
import { BRAND } from '@/lib/tokens/brand';
import { saveTeam } from './actions';

export const metadata: Metadata = { title: m.admin.teams.title };

export default async function AdminTeamsPage({ searchParams }: { searchParams: Promise<{ edizione?: string }> }) {
  await requirePermission('teams.write');
  const db = await getDb();
  const { all, current } = await workingEdition(db, (await searchParams).edizione);
  const rows = await db.select().from(teams).orderBy(asc(teams.name));
  const entries = current
    ? await db
        .select({ entry: teamEntries, groupName: groups.name })
        .from(teamEntries)
        .leftJoin(groups, eq(groups.id, teamEntries.groupId))
        .where(eq(teamEntries.editionId, current.id))
    : [];
  const labels = m.admin.teams;

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        <AdminTitle title={labels.title} text={current?.name} />
        <EditionSwitch years={all.map((edition) => edition.year)} current={current?.year ?? null} base="/admin/squadre" />
        {rows.length === 0 ? (
          <p className="text-lg">{labels.empty}</p>
        ) : (
          <ul className="card divide-y divide-line">
            {rows.map((team) => {
              const entry = entries.find((item) => item.entry.teamId === team.id);
              return (
                <li key={team.id}>
                  <Link href={`/admin/squadre/${team.id}${current ? `?edizione=${current.year}` : ''}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-surface-2">
                    <span className="display w-12 text-xl">{team.shortCode}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{team.name}</span>
                    {team.archivedAt ? <Pill tone="outline">{m.admin.common.archive}</Pill> : null}
                    {entry && entry.entry.status !== 'withdrawn' ? <Pill tone="sky">{entry.groupName ? fmt(m.match.group, { group: entry.groupName }) : labels.enrolled}</Pill> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Panel title={labels.new}>
        <ActionForm action={saveTeam} submitLabel={m.admin.common.create} className="space-y-4" errorsFor={['name', 'shortCode']}>
          <TextField id="name" label={labels.name} required maxLength={80} />
          <div className="grid grid-cols-2 gap-4">
            <TextField id="shortCode" label={labels.shortCode} required maxLength={3} className="uppercase" />
            <TextField id="kitColor" label={labels.kitColor} type="color" defaultValue={BRAND.sky.toLowerCase()} />
          </div>
        </ActionForm>
      </Panel>
    </div>
  );
}
