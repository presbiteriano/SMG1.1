import { Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, PageHeader, SectionHeading } from '@/components/ui';
import type { HonourCell } from '@/lib/data/dto';
import { getHallOfFame } from '@/lib/data/queries';
import { countLabel, fmt, m } from '@/lib/i18n';

export const metadata: Metadata = { title: m.hall.title, description: m.hall.question };

function Cell({ cell, label }: { cell: HonourCell; label: string }) {
  if (!cell.winner) {
    return (
      <div className="rounded-xl border border-dashed border-white/25 p-4">
        <p className="kicker text-xs text-accent">{label}</p>
        <p className="mt-1 opacity-70">{m.hall.notPlayed}</p>
      </div>
    );
  }
  const name = cell.winner.slug ? (
    <Link href={`/squadre/${cell.winner.slug}`} className="underline-offset-4 hover:underline">
      {cell.winner.name}
    </Link>
  ) : (
    cell.winner.name
  );
  return (
    <div className="rounded-xl bg-white/10 p-4" data-team={cell.winner.slug ?? undefined}>
      <p className="kicker flex items-center gap-1.5 text-xs text-accent">
        <Trophy aria-hidden className="size-4" />
        {label}
      </p>
      <p className="display mt-1 text-3xl sm:text-4xl">{name}</p>
      {/* Se di un'edizione si conosce solo il vincitore, si mostra solo quello: niente buchi (brief 7.8). */}
      <dl className="mt-2 space-y-0.5 text-sm">
        {cell.runnerUp ? (
          <div className="flex gap-1.5">
            <dt className="opacity-70">{m.hall.runnerUp}:</dt>
            <dd className="font-semibold">{cell.runnerUp.name}</dd>
          </div>
        ) : null}
        {cell.topScorer ? (
          <div className="flex gap-1.5">
            <dt className="opacity-70">{m.hall.topScorer}:</dt>
            <dd className="font-semibold">
              {cell.topScorer.name}
              {cell.topScorer.goals !== null ? ` (${fmt(m.hall.goals, { n: cell.topScorer.goals })})` : ''}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

// Albo d'oro (brief 7.8): la bacheca dei trofei. Risponde a: chi ha vinto, anno per anno.
export default async function HallOfFamePage() {
  const { data: rows } = await getHallOfFame();

  const titles = new Map<string, { name: string; slug: string | null; count: number }>();
  for (const row of rows) {
    for (const cell of [row.cup, row.supercup]) {
      if (!cell.winner) continue;
      const key = cell.winner.slug ?? cell.winner.name;
      const known = titles.get(key);
      titles.set(key, { name: cell.winner.name, slug: cell.winner.slug, count: (known?.count ?? 0) + 1 });
    }
  }
  const ranking = [...titles.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'it'));

  return (
    <>
      <PageHeader title={m.hall.title} question={m.hall.question} />
      <div className="container-page space-y-10 pb-10">
        {rows.length === 0 ? (
          <EmptyState title={m.hall.empty} />
        ) : (
          <>
            <ol className="space-y-4">
              {rows.map((row) => (
                <li key={row.year} className="on-dark grid gap-4 rounded-card bg-inverse p-4 text-on-inverse sm:grid-cols-[auto_1fr_1fr] sm:items-center sm:p-6">
                  <div>
                    <p className="display text-6xl text-accent tabular-nums sm:text-7xl">{row.year}</p>
                    <Link href={`/edizioni/${row.year}`} className="kicker inline-flex min-h-11 items-center text-xs underline underline-offset-4">
                      {m.editions.open}
                    </Link>
                  </div>
                  <Cell cell={row.cup} label={m.hall.cup} />
                  <Cell cell={row.supercup} label={m.hall.supercup} />
                </li>
              ))}
            </ol>

            <section aria-labelledby="titolate">
              <SectionHeading id="titolate" title={m.hall.ranking} />
              <ol className="card divide-y divide-line">
                {ranking.map((team, index) => (
                  <li key={team.slug ?? team.name} data-team={team.slug ?? undefined} className="flex min-h-12 items-center gap-4 px-4 py-2">
                    <span className="display w-6 text-xl">{index + 1}</span>
                    <span className="flex-1 font-semibold">{team.slug ? <Link href={`/squadre/${team.slug}`}>{team.name}</Link> : team.name}</span>
                    <span className="display text-xl">{countLabel(team.count, m.hall.titlesCountOne, m.hall.titlesCount)}</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>
    </>
  );
}
