import type { Metadata } from 'next';
import Link from 'next/link';
import { TeamSearch } from '@/components/team-search';
import { EmptyState, PageHeader } from '@/components/ui';
import { param, type SearchParams } from '@/lib/data/public';
import { getSite, getTeamsIndex } from '@/lib/data/queries';
import { countLabel, m } from '@/lib/i18n';
import { parseYear } from '@/lib/site';
import { cx } from '@/lib/ui';

export const metadata: Metadata = { title: m.teams.title, description: m.teams.question };

// Squadre di tutte le edizioni (brief 7.5), con ricerca e filtro per edizione.
export default async function TeamsPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ data: teams }, { data: site }] = await Promise.all([getTeamsIndex(), getSite()]);
  const year = parseYear(param(await searchParams, 'edizione') ?? undefined);
  const years = site.editions.filter((edition) => edition.teamCount > 0).map((edition) => edition.year);
  const selected = year !== null && years.includes(year) ? year : null;
  const list = teams
    .filter((team) => team.years.length > 0 && (selected === null || team.years.includes(selected)))
    .map((team) => ({ ...team, note: countLabel(team.years.length, m.teams.editionsPlayedOne, m.teams.editionsPlayed) }));
  const chip = 'kicker inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm';

  return (
    <>
      <PageHeader title={m.teams.title} question={m.teams.question} />
      <div className="container-page space-y-5 pb-10">
        {years.length > 1 ? (
          <nav aria-label={m.teams.edition}>
            <ul className="rail gap-2">
              <li>
                <Link href="/squadre" aria-current={selected === null ? 'true' : undefined} className={cx(chip, selected === null ? 'bg-inverse text-on-inverse' : 'border border-line')}>
                  {m.teams.allEditions}
                </Link>
              </li>
              {years.map((item) => (
                <li key={item}>
                  <Link href={`/squadre?edizione=${item}`} aria-current={selected === item ? 'true' : undefined} className={cx(chip, selected === item ? 'bg-inverse text-on-inverse' : 'border border-line')}>
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        {list.length === 0 ? <EmptyState title={m.teams.empty} /> : <TeamSearch teams={list} labels={{ label: m.teams.searchLabel, placeholder: m.teams.searchPlaceholder, noMatch: m.teams.noMatch }} />}
      </div>
    </>
  );
}
