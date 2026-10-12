import { CalendarPlus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MatchCard } from '@/components/match-card';
import { FollowButton } from '@/components/site/follow';
import { TeamCrest } from '@/components/team-crest';
import { buttonClass, Kicker, SectionHeading } from '@/components/ui';
import { byKickoff } from '@/lib/bracket/view';
import type { EditionBundle } from '@/lib/data/dto';
import { param, type SearchParams } from '@/lib/data/public';
import { getEdition, getTeamsIndex } from '@/lib/data/queries';
import { siteUrl } from '@/lib/env';
import { fmt, m } from '@/lib/i18n';
import { parseYear } from '@/lib/site';
import { cx } from '@/lib/ui';

type Props = { params: Promise<{ slug: string }>; searchParams: SearchParams };

async function loadTeam(slug: string) {
  const { data: teams } = await getTeamsIndex();
  const team = teams.find((item) => item.slug === slug);
  if (!team) notFound();
  return team;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const team = await loadTeam((await params).slug);
  return { title: team.name, description: `${team.name}: ${m.team.matches}, ${m.nav.standings.toLowerCase()}, ${m.team.history.toLowerCase()}.` };
}

/** Fin dove è arrivata la squadra in un'edizione: posizione nel girone e ultimo turno giocato. */
function journey(bundle: EditionBundle, slug: string) {
  const row = bundle.competitions.flatMap((competition) => competition.stages.flatMap((stage) => stage.groups.map((group) => ({ group, row: group.rows.find((item) => item.team.slug === slug) })))).find((item) => item.row);
  const knockout = bundle.matches.filter((match) => match.stageKind !== 'group' && match.competitionType !== 'supercup' && (match.home?.slug === slug || match.away?.slug === slug)).sort(byKickoff);
  return {
    group: row?.group ?? null,
    row: row?.row ?? null,
    lastStage: knockout.at(-1)?.stageName ?? null,
    champion: bundle.cup?.winner.slug === slug,
  };
}

// Scheda squadra (brief 7.5): risultati, posizione, calendario e storico nelle varie edizioni.
export default async function TeamPage({ params, searchParams }: Props) {
  const team = await loadTeam((await params).slug);
  const requested = parseYear(param(await searchParams, 'edizione') ?? undefined);
  const year = requested !== null && team.years.includes(requested) ? requested : (team.years[0] ?? null);

  const bundles = (await Promise.all(team.years.map((item) => getEdition(item)))).map((snapshot) => snapshot.data).filter((bundle): bundle is EditionBundle => bundle !== null);
  const current = bundles.find((bundle) => bundle.edition.year === year) ?? null;
  const entry = current?.teams.find((item) => item.slug === team.slug) ?? null;
  const path = current ? journey(current, team.slug) : null;
  const matches = current ? current.matches.filter((match) => match.home?.slug === team.slug || match.away?.slug === team.slug).sort(byKickoff) : [];
  const chip = 'kicker inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm';

  const jsonLd = { '@context': 'https://schema.org', '@type': 'SportsTeam', name: team.name, sport: 'Soccer', url: `${siteUrl()}/squadre/${team.slug}` };

  return (
    <div className="container-page space-y-10 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <header className="flex flex-wrap items-center gap-5">
        <TeamCrest team={team} size={96} />
        <div className="min-w-0 flex-1">
          <Kicker className="text-link">{team.code}</Kicker>
          <h1 className="text-5xl sm:text-6xl">{team.name}</h1>
          {path?.row && path.group ? (
            <p className="mt-2 font-semibold">
              {fmt(m.team.position, { pos: path.row.position, group: path.group.name })}
              {current ? ` · ${current.edition.name}` : ''}
            </p>
          ) : current ? (
            <p className="mt-2 text-muted">
              {m.team.noGroup} · {current.edition.name}
            </p>
          ) : null}
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-4">
        <FollowButton slug={team.slug} name={team.name} labels={m.follow} />
        {matches.some((match) => match.status === 'scheduled' && match.kickoffAt) ? (
          <a href={`/api/ics/squadra/${team.slug}`} className={buttonClass('outline')}>
            <CalendarPlus aria-hidden className="size-5" />
            {m.team.addCalendar}
          </a>
        ) : null}
      </div>

      {team.years.length > 1 ? (
        <nav aria-label={m.teams.edition}>
          <ul className="rail gap-2">
            {team.years.map((item) => (
              <li key={item}>
                <Link href={`/squadre/${team.slug}?edizione=${item}`} aria-current={item === year ? 'true' : undefined} className={cx(chip, item === year ? 'bg-inverse text-on-inverse' : 'border border-line')}>
                  {item}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {path?.row ? (
        <p className="card p-4 text-lg">
          <strong className="font-semibold">{fmt(m.team.summary, { played: path.row.played, won: path.row.won, drawn: path.row.drawn, lost: path.row.lost })}</strong>
          <span className="text-muted"> · {fmt(m.team.goalsSummary, { gf: path.row.goalsFor, ga: path.row.goalsAgainst })}</span>
        </p>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="partite">
          <SectionHeading id="partite" title={m.team.matches} />
          {matches.length === 0 || !current ? (
            <p className="text-muted">{m.team.matchesEmpty}</p>
          ) : (
            <ul className="space-y-3">
              {matches.map((match) => (
                <li key={match.id}>
                  <MatchCard match={match} year={current.edition.year} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-10">
          {entry?.roster ? (
            <section aria-labelledby="rosa">
              <SectionHeading id="rosa" title={m.team.roster} />
              {entry.roster.length === 0 ? (
                <p className="text-muted">{m.team.rosterEmpty}</p>
              ) : (
                <>
                  <table className="card w-full overflow-hidden text-left">
                    <thead>
                      <tr className="border-b border-line">
                        <th scope="col" className="kicker w-12 px-3 py-2 text-xs text-muted">
                          {m.team.number}
                        </th>
                        <th scope="col" className="kicker px-2 py-2 text-xs text-muted">
                          {m.team.name}
                        </th>
                        <th scope="col" className="kicker px-3 py-2 text-xs text-muted">
                          {m.team.role}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.roster.map((player, index) => (
                        <tr key={index} className="border-b border-line last:border-b-0">
                          <td className="display px-3 py-2 text-xl tabular-nums">{player.number ?? ''}</td>
                          <td className={cx('px-2 py-2', player.hidden ? 'text-muted' : 'font-semibold')}>{player.name}</td>
                          <td className="px-3 py-2 text-sm text-muted">{player.role ? m.team.roles[player.role] : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-sm text-muted">{m.team.rosterNote}</p>
                </>
              )}
            </section>
          ) : null}

          <section aria-labelledby="storico">
            <SectionHeading id="storico" title={m.team.history} />
            <ul className="card divide-y divide-line">
              {bundles.map((bundle) => {
                const past = journey(bundle, team.slug);
                return (
                  <li key={bundle.edition.year}>
                    <Link href={`/edizioni/${bundle.edition.year}`} className="flex min-h-14 items-center gap-4 px-4 py-2 hover:bg-surface-2">
                      <span className="display text-3xl tabular-nums">{bundle.edition.year}</span>
                      <span className="min-w-0 text-sm">
                        {past.champion ? <strong className="kicker block text-sm">{m.team.historyWinner}</strong> : null}
                        {past.row && past.group ? <span className="block">{fmt(m.team.historyGroup, { pos: past.row.position, group: past.group.name })}</span> : null}
                        {past.lastStage && !past.champion ? <span className="block text-muted">{fmt(m.team.historyReached, { stage: past.lastStage })}</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
