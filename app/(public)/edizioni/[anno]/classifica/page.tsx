import type { Metadata } from 'next';
import { DataFreshness } from '@/components/sections';
import { StandingsLegend, StandingsTable } from '@/components/standings-table';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireEdition } from '@/lib/data/public';
import { m } from '@/lib/i18n';

export const metadata: Metadata = { title: m.standings.title };

// Classifica (brief 7.3): una tabella per girone, calcolata dai risultati. Mai inserita a mano.
export default async function StandingsPage({ params }: { params: Promise<{ anno: string }> }) {
  const snapshot = await requireEdition((await params).anno);
  const { edition, competitions } = snapshot.data;
  const groups = competitions.flatMap((competition) => competition.stages.flatMap((stage) => stage.groups)).filter((group) => group.rows.length > 0);
  const leaderNote = groups.some((group) => group.hasResults && group.provisional);

  return (
    <>
      <PageHeader compact title={m.standings.title} question={leaderNote ? m.standings.leaderNote : undefined} />
      <div className="container-page space-y-6 pb-10">
        {groups.length === 0 ? (
          <EmptyState title={m.standings.noGroups} />
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              {groups.map((group) => (
                <StandingsTable key={group.id} group={group} />
              ))}
            </div>
            {groups.some((group) => group.hasResults) ? null : <p className="text-muted">{m.standings.empty}</p>}
            <StandingsLegend groups={groups} config={edition.config} />
            <DataFreshness generatedAt={snapshot.generatedAt} degraded={snapshot.degraded} />
          </>
        )}
      </div>
    </>
  );
}
