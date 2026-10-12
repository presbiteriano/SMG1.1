import { Megaphone, Trophy } from 'lucide-react';
import Link from 'next/link';
import { activeAnnouncements } from '@/components/announcement-banner';
import { HomeHero } from '@/components/home-hero';
import { MatchRail } from '@/components/match-rail';
import { DataFreshness, ShortcutCircles, SponsorStrip } from '@/components/sections';
import { StandingsTable } from '@/components/standings-table';
import { ButtonLink, EmptyState, SectionHeading, TextLink } from '@/components/ui';
import { railMatches } from '@/lib/bracket/view';
import type { EditionBundle, GroupDTO } from '@/lib/data/dto';
import { getEdition, getHallOfFame, getSite } from '@/lib/data/queries';
import { formatRome } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';
import { visibleSponsors } from '@/lib/site';

/** Il girone da mostrare in home: quello che ha giocato per ultimo (brief 18.7). */
function spotlightGroup(bundle: EditionBundle): GroupDTO | null {
  const groups = bundle.competitions.flatMap((competition) => competition.stages.flatMap((stage) => stage.groups));
  if (groups.length === 0) return null;
  const lastPlayed = [...bundle.matches]
    .filter((match) => match.groupId !== null && (match.status === 'live' || match.status === 'finished' || match.status === 'forfeited'))
    .sort((a, b) => (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? ''))
    .at(-1);
  return groups.find((group) => group.id === lastPlayed?.groupId) ?? groups[0];
}

// Home (brief 7.1): in tre secondi dice cosa succede adesso e dove andare.
// Gerarchia: contesto (selettore edizione) > cosa succede ora (MatchRail) > cosa conta (hero e classifica)
// > dove andare (cerchi) > novità > sponsor.
export default async function HomePage() {
  const now = new Date();
  const { data: site } = await getSite();
  const featuredSnapshot = site.featuredYear ? await getEdition(site.featuredYear) : null;
  const featured = featuredSnapshot?.data ?? null;

  // Se la prossima edizione non ha ancora partite, la striscia e la classifica mostrano l'ultima che ne ha.
  const dataYear = featured && featured.matches.length > 0 ? featured.edition.year : site.dataYear;
  const dataSnapshot = dataYear === null ? null : dataYear === featured?.edition.year ? featuredSnapshot : await getEdition(dataYear);
  const data = dataSnapshot?.data ?? null;

  const rail = data ? railMatches(data.matches) : null;
  const group = data ? spotlightGroup(data) : null;
  const showStandings = group !== null && group.rows.length > 0;
  const news = activeAnnouncements(site.announcements, now).slice(0, 3);
  const hall = (await getHallOfFame()).data.slice(0, 3);
  const sponsors = visibleSponsors(site, site.featuredYear, now);

  return (
    <>
      {data && rail ? <MatchRail matches={rail.items} year={data.edition.year} focusId={rail.focusId} label={fmt(m.home.railFrom, { edition: data.edition.name })} /> : null}

      <div className="container-page grid gap-6 pt-6 lg:grid-cols-3">
        <div className={showStandings ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <HomeHero bundle={featured} site={site} now={now} />
        </div>
        {showStandings && data && group && dataSnapshot ? (
          <aside aria-label={m.standings.title} className="flex flex-col gap-3">
            <StandingsTable group={group} compact limit={6} />
            <div className="flex flex-wrap items-center justify-between gap-x-4">
              <TextLink href={`/edizioni/${data.edition.year}/classifica`}>{m.standings.seeAll}</TextLink>
              <DataFreshness generatedAt={dataSnapshot.generatedAt} degraded={dataSnapshot.degraded} />
            </div>
          </aside>
        ) : null}
      </div>

      <div className="container-page mt-10">
        <ShortcutCircles year={data?.edition.year ?? site.featuredYear} />
      </div>

      <div className="container-page mt-12 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="novita">
          <SectionHeading id="novita" title={m.home.news} />
          {news.length === 0 ? (
            <EmptyState title={m.home.newsEmpty} />
          ) : (
            <ul className="space-y-3">
              {news.map((item) => (
                <li key={item.id} className="card flex gap-3 p-4">
                  <Megaphone aria-hidden className="mt-0.5 size-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="kicker text-xs text-muted">
                      {m.announcement[item.severity]} · {formatRome(item.startsAt, 'dayShort')}
                    </p>
                    <p className="font-semibold">{item.title}</p>
                    {item.body ? <p className="text-muted">{item.body}</p> : null}
                    {item.link ? (
                      <Link href={item.link} className="mt-1 inline-flex min-h-11 items-center font-semibold text-link underline">
                        {m.announcement.more}
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="albo" className="on-dark rounded-card bg-inverse p-5 text-on-inverse sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <Trophy aria-hidden className="size-8 text-accent" />
            <div>
              <h2 id="albo" className="text-3xl">
                {m.home.hallTeaser}
              </h2>
              <p className="text-sm opacity-90">{m.home.hallTeaserText}</p>
            </div>
          </div>
          {hall.length === 0 ? (
            <p className="opacity-90">{m.hall.empty}</p>
          ) : (
            <ul className="divide-y divide-white/15">
              {hall.map((row) => (
                <li key={row.year} className="flex items-baseline gap-4 py-2.5">
                  <span className="display text-4xl text-accent tabular-nums">{row.year}</span>
                  <span className="min-w-0">
                    <span className="display block truncate text-2xl">{row.cup.winner?.name ?? m.hall.notPlayed}</span>
                    <span className="kicker text-xs opacity-80">{m.hall.cup}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ButtonLink href="/albo-doro" variant="accent" className="mt-5">
            {m.home.hallCta}
          </ButtonLink>
        </section>
      </div>

      {sponsors.length > 0 ? (
        <section aria-labelledby="sponsor" className="container-page mt-12">
          <SectionHeading id="sponsor" title={m.home.sponsorTitle} action={<TextLink href="/sponsor">{m.home.sponsorCta}</TextLink>} />
          <SponsorStrip sponsors={sponsors} />
        </section>
      ) : null}
    </>
  );
}
