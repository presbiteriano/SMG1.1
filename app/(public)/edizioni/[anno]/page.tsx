import { Trophy } from 'lucide-react';
import { MatchCard } from '@/components/match-card';
import { DataFreshness } from '@/components/sections';
import { TeamCrest } from '@/components/team-crest';
import { ButtonLink, EmptyState, SectionHeading, TextLink } from '@/components/ui';
import { byKickoff } from '@/lib/bracket/view';
import { requireEdition } from '@/lib/data/public';
import { getHallOfFame } from '@/lib/data/queries';
import { fmt, m } from '@/lib/i18n';

function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="card p-4">
      <p className="display text-5xl tabular-nums">{value}</p>
      <p className="kicker mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

// Panoramica dell'edizione: chi ha vinto, i numeri, ultimi risultati e prossime partite.
export default async function EditionPage({ params }: { params: Promise<{ anno: string }> }) {
  const snapshot = await requireEdition((await params).anno);
  const bundle = snapshot.data;
  const { edition, stats } = bundle;
  const base = `/edizioni/${edition.year}`;
  const sorted = [...bundle.matches].sort(byKickoff);
  const recent = sorted.filter((match) => match.status === 'finished' || match.status === 'forfeited' || match.status === 'live').slice(-3).reverse();
  const next = sorted.filter((match) => match.status === 'scheduled' || match.status === 'postponed').slice(0, 3);

  // Edizione di cui si conosce solo il vincitore: si mostra quello, senza buchi (brief 7.8).
  const honour = bundle.cup ? null : (await getHallOfFame()).data.find((row) => row.year === edition.year);
  const championName = bundle.cup?.winner.name ?? honour?.cup.winner?.name ?? null;

  return (
    <div className="container-page space-y-10 py-8">
      <h1 className="sr-only">
        {edition.name}: {m.editions.overview}
      </h1>

      {championName ? (
        <section className="floodlit flex flex-wrap items-center gap-4 rounded-card p-5 sm:p-7" data-team={bundle.cup?.winner.slug}>
          {bundle.cup ? <TeamCrest team={bundle.cup.winner} size={72} /> : <Trophy aria-hidden className="size-14" />}
          <div className="min-w-0 flex-1">
            <p className="kicker text-xs">
              {m.editions.champion} · {m.hall.cup}
            </p>
            <p className="display text-5xl sm:text-6xl">{championName}</p>
            {bundle.cup?.runnerUp ? (
              <p className="mt-1 font-semibold">
                {m.hall.runnerUp}: {bundle.cup.runnerUp.name}
              </p>
            ) : null}
          </div>
          {bundle.matches.length > 0 ? <ButtonLink href={`${base}/tabellone`}>{m.nav.bracket}</ButtonLink> : null}
        </section>
      ) : null}

      {bundle.matches.length === 0 ? (
        <EmptyState title={championName ? m.editions.noDetails : m.calendar.empty} />
      ) : (
        <>
          <section aria-label={m.stats.title} className="grid grid-cols-3 gap-3">
            <Figure value={bundle.teams.length} label={m.editions.teams} />
            <Figure value={stats.matchesPlayed} label={m.editions.matchesPlayed} />
            <Figure value={stats.goals} label={m.editions.goals} />
          </section>

          <div className="grid gap-10 lg:grid-cols-2">
            {recent.length > 0 ? (
              <section aria-labelledby="ultimi">
                <SectionHeading id="ultimi" title={m.editions.lastResults} action={<TextLink href={`${base}/calendario`}>{m.common.seeAll}</TextLink>} />
                <ul className="space-y-3">
                  {recent.map((match) => (
                    <li key={match.id}>
                      <MatchCard match={match} year={edition.year} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {next.length > 0 ? (
              <section aria-labelledby="prossime">
                <SectionHeading id="prossime" title={m.editions.nextMatches} action={<TextLink href={`${base}/calendario`}>{m.common.seeAll}</TextLink>} />
                <ul className="space-y-3">
                  {next.map((match) => (
                    <li key={match.id}>
                      <MatchCard match={match} year={edition.year} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
          <DataFreshness generatedAt={snapshot.generatedAt} degraded={snapshot.degraded} />
        </>
      )}
      {bundle.matches.length > 0 ? <p className="sr-only">{fmt(m.editions.teamsCount, { n: bundle.teams.length })}</p> : null}
    </div>
  );
}
