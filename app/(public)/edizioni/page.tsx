import { Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Skyline } from '@/components/skyline';
import { EmptyState, PageHeader, Pill } from '@/components/ui';
import { getHallOfFame, getSite } from '@/lib/data/queries';
import { fmt, m } from '@/lib/i18n';
import { editionDates, editionHref } from '@/lib/site';

export const metadata: Metadata = { title: m.editions.title, description: m.editions.question };

// Archivio (brief 7.8): una card per anno, dalla più recente. Risponde a: quali edizioni ci sono state.
export default async function EditionsPage() {
  const [{ data: site }, { data: hall }] = await Promise.all([getSite(), getHallOfFame()]);

  return (
    <>
      <PageHeader title={m.editions.title} question={m.editions.question} />
      <div className="container-page pb-10">
        {site.editions.length === 0 ? (
          <EmptyState title={m.editions.empty} />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {site.editions.map((edition) => {
              const winner = hall.find((row) => row.year === edition.year)?.cup.winner;
              return (
                <li key={edition.year}>
                  <Link href={editionHref(edition)} className="card group block overflow-hidden transition-colors hover:border-ink">
                    <div className="floodlit relative">
                      <div className="flex items-start justify-between gap-3 p-4">
                        <p className="display text-7xl tabular-nums">{edition.year}</p>
                        <Pill tone="ink">{m.status.edition[edition.status]}</Pill>
                      </div>
                      <Skyline />
                    </div>
                    <div className="space-y-2 p-4">
                      <p className="display text-2xl">{edition.name}</p>
                      <p className="text-sm text-muted">{editionDates(edition)}</p>
                      {winner ? (
                        <p className="flex items-center gap-2 font-semibold">
                          <Trophy aria-hidden className="size-5 shrink-0" />
                          <span>
                            <span className="kicker mr-1.5 text-xs text-muted">{m.editions.cupWinner}</span>
                            {winner.name}
                          </span>
                        </p>
                      ) : null}
                      {edition.teamCount > 0 ? <p className="text-sm text-muted">{fmt(m.editions.teamsCount, { n: edition.teamCount })}</p> : null}
                      <p className="kicker pt-1 text-xs text-link underline underline-offset-4">{m.editions.open}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
