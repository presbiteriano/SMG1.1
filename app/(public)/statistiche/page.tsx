import type { Metadata } from 'next';
import Link from 'next/link';
import { DataFreshness } from '@/components/sections';
import { EmptyState, PageHeader, SectionHeading } from '@/components/ui';
import type { EditionBundle, ScorerDTO, StatsDTO, TeamStatDTO } from '@/lib/data/dto';
import { param, type SearchParams } from '@/lib/data/public';
import { getEdition, getSite } from '@/lib/data/queries';
import { fmt, m } from '@/lib/i18n';
import { parseYear } from '@/lib/site';
import { cx } from '@/lib/ui';

export const metadata: Metadata = { title: m.stats.title, description: m.stats.question };

const ALL_TIME = 'sempre';

/** Somma le statistiche di più edizioni. Miglior attacco e difesa valgono solo dentro una singola edizione. */
function combine(bundles: EditionBundle[]): StatsDTO {
  const scorers = new Map<string, ScorerDTO>();
  const fair = new Map<string, TeamStatDTO>();
  const total: StatsDTO = { matchesPlayed: 0, goals: 0, shootouts: 0, yellow: 0, red: 0, topScorers: [], bestAttack: [], bestDefense: [], fairPlay: [], mvps: [] };
  for (const { stats } of bundles) {
    total.matchesPlayed += stats.matchesPlayed;
    total.goals += stats.goals;
    total.shootouts += stats.shootouts;
    total.yellow += stats.yellow;
    total.red += stats.red;
    total.mvps.push(...stats.mvps);
    for (const scorer of stats.topScorers) {
      // Chi compare solo con il numero di maglia non si può riconoscere da un anno all'altro: non si somma.
      const key = scorer.hidden ? `${scorer.teamSlug}:${scorer.name}:${stats.matchesPlayed}:${scorer.goals}` : `${scorer.teamSlug}:${scorer.name}`;
      const known = scorers.get(key);
      scorers.set(key, known ? { ...known, goals: known.goals + scorer.goals } : { ...scorer });
    }
    for (const team of stats.fairPlay) {
      const known = fair.get(team.teamSlug);
      fair.set(team.teamSlug, known ? { ...known, value: known.value + team.value } : { ...team });
    }
  }
  total.topScorers = [...scorers.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'it')).slice(0, 20);
  total.fairPlay = [...fair.values()].sort((a, b) => a.value - b.value || a.teamName.localeCompare(b.teamName, 'it'));
  return total;
}

function Figure({ value, label, note }: { value: string | number; label: string; note?: string }) {
  return (
    <div className="card p-4">
      <p className="display text-5xl tabular-nums">{value}</p>
      <p className="kicker mt-1 text-xs text-muted">
        {label}
        {note ? <span className="tracking-normal normal-case"> ({note})</span> : null}
      </p>
    </div>
  );
}

function TeamList({ teams, format }: { teams: TeamStatDTO[]; format: (value: number) => string }) {
  return (
    <ul className="card divide-y divide-line">
      {teams.map((team) => (
        <li key={team.teamSlug} data-team={team.teamSlug}>
          <Link href={`/squadre/${team.teamSlug}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
            <span className="font-semibold">{team.teamName}</span>
            <span className="display text-xl">{format(team.value)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Statistiche (brief 7.7): compaiono solo se esistono dati e si possono spegnere per edizione.
export default async function StatsPage({ searchParams }: { searchParams: SearchParams }) {
  const { data: site } = await getSite();
  const withMatches = site.editions.filter((edition) => edition.matchCount > 0);
  const requested = param(await searchParams, 'edizione');
  const year = requested === ALL_TIME ? null : (parseYear(requested ?? undefined) ?? withMatches[0]?.year ?? null);

  const snapshots = await Promise.all((year === null ? withMatches.map((edition) => edition.year) : [year]).map((item) => getEdition(item)));
  const bundles = snapshots.map((snapshot) => snapshot.data).filter((bundle): bundle is EditionBundle => bundle !== null && bundle.edition.config.features.stats);
  const disabled = year !== null && snapshots[0]?.data !== null && bundles.length === 0;
  const stats = bundles.length === 1 ? bundles[0].stats : combine(bundles);
  const fairConfig = bundles[0]?.edition.config.fair_play ?? { yellow: 1, red: 3 };
  const chip = 'kicker inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm';

  return (
    <>
      <PageHeader title={m.stats.title} question={m.stats.question} />
      <div className="container-page space-y-8 pb-10">
        {withMatches.length > 0 ? (
          <nav aria-label={m.stats.edition}>
            <ul className="rail gap-2">
              {withMatches.map((edition) => (
                <li key={edition.year}>
                  <Link href={`/statistiche?edizione=${edition.year}`} aria-current={year === edition.year ? 'true' : undefined} className={cx(chip, year === edition.year ? 'bg-inverse text-on-inverse' : 'border border-line')}>
                    {edition.year}
                  </Link>
                </li>
              ))}
              {withMatches.length > 1 ? (
                <li>
                  <Link href={`/statistiche?edizione=${ALL_TIME}`} aria-current={year === null ? 'true' : undefined} className={cx(chip, year === null ? 'bg-inverse text-on-inverse' : 'border border-line')}>
                    {m.stats.allTime}
                  </Link>
                </li>
              ) : null}
            </ul>
          </nav>
        ) : null}

        {disabled ? (
          <EmptyState title={m.stats.disabled} />
        ) : stats.matchesPlayed === 0 ? (
          <EmptyState title={m.stats.empty} />
        ) : (
          <>
            <section aria-label={m.stats.title} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Figure value={stats.matchesPlayed} label={m.stats.matchesPlayed} />
              <Figure value={stats.goals} label={m.stats.goals} note={m.stats.goalsNote} />
              <Figure value={(stats.goals / stats.matchesPlayed).toLocaleString('it-IT', { maximumFractionDigits: 2 })} label={m.stats.avgGoals} />
              <Figure value={stats.shootouts} label={m.stats.shootouts} />
              {stats.yellow + stats.red > 0 ? (
                <>
                  <Figure value={stats.yellow} label={m.stats.yellow} />
                  <Figure value={stats.red} label={m.stats.red} />
                </>
              ) : null}
            </section>

            <div className="grid gap-10 lg:grid-cols-2">
              <section aria-labelledby="marcatori">
                <SectionHeading id="marcatori" title={m.stats.topScorers} />
                {stats.topScorers.length === 0 ? (
                  <p className="text-muted">{m.stats.topScorersEmpty}</p>
                ) : (
                  <>
                    <table className="card w-full overflow-hidden text-left">
                      <thead>
                        <tr className="border-b border-line">
                          <th scope="col" className="kicker w-10 px-3 py-2 text-center text-xs text-muted">
                            {m.standings.pos}
                          </th>
                          <th scope="col" className="kicker px-2 py-2 text-xs text-muted">
                            {m.stats.player}
                          </th>
                          <th scope="col" className="kicker px-2 py-2 text-xs text-muted">
                            {m.stats.team}
                          </th>
                          <th scope="col" className="kicker px-3 py-2 text-right text-xs text-muted">
                            {m.stats.goalsCol}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.topScorers.slice(0, 10).map((scorer, index) => (
                          <tr key={`${scorer.teamSlug}-${scorer.name}-${index}`} data-team={scorer.teamSlug} className={cx('border-b border-line last:border-b-0', index === 0 && 'bg-surface-2')}>
                            <td className="display px-3 py-2 text-center text-lg">{index + 1}</td>
                            <td className={cx('px-2 py-2', scorer.hidden ? 'text-muted' : 'font-semibold')}>{scorer.name}</td>
                            <td className="display px-2 py-2 text-lg">
                              <Link href={`/squadre/${scorer.teamSlug}`}>{scorer.teamCode}</Link>
                            </td>
                            <td className="display px-3 py-2 text-right text-2xl tabular-nums">{scorer.goals}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-sm text-muted">{m.stats.minorNote}</p>
                  </>
                )}
              </section>

              <div className="space-y-8">
                {stats.bestAttack.length > 0 ? (
                  <section aria-labelledby="attacco">
                    <SectionHeading id="attacco" title={m.stats.bestAttack} />
                    <TeamList teams={stats.bestAttack} format={(value) => fmt(m.stats.goalsScored, { n: value })} />
                  </section>
                ) : null}
                {stats.bestDefense.length > 0 ? (
                  <section aria-labelledby="difesa">
                    <SectionHeading id="difesa" title={m.stats.bestDefense} />
                    <TeamList teams={stats.bestDefense} format={(value) => fmt(m.stats.goalsConceded, { n: value })} />
                  </section>
                ) : null}
                {stats.mvps.length > 0 ? (
                  <section aria-labelledby="mvp">
                    <SectionHeading id="mvp" title={m.stats.mvp} />
                    <ul className="card divide-y divide-line">
                      {stats.mvps.map((mvp) => (
                        <li key={mvp.matchId} className="flex items-center justify-between gap-3 px-4 py-3">
                          <span className="font-semibold">
                            {mvp.name} <span className="display text-lg text-muted">{mvp.teamCode}</span>
                          </span>
                          <span className="kicker text-xs text-muted">{mvp.label}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {stats.fairPlay.length > 0 ? (
                  <section aria-labelledby="fairplay">
                    <SectionHeading id="fairplay" title={m.stats.fairPlay} />
                    <p className="mb-3 text-sm text-muted">{fmt(m.stats.fairPlayNote, fairConfig)}</p>
                    <TeamList teams={stats.fairPlay.slice(0, 5)} format={(value) => fmt(m.stats.fairPlayPoints, { n: value })} />
                  </section>
                ) : null}
              </div>
            </div>
            {snapshots[0] ? <DataFreshness generatedAt={snapshots[0].generatedAt} degraded={snapshots.some((snapshot) => snapshot.degraded)} /> : null}
          </>
        )}
      </div>
    </>
  );
}
