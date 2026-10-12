import type { EditionBundle } from '@/lib/data/dto';
import { getEdition, getSite, getTeamsIndex } from '@/lib/data/queries';
import { fmt, m } from '@/lib/i18n';
import type { SearchEntry } from '@/lib/search';

// Indice della ricerca: squadre, giocatori (solo quelli con nome pubblicabile) e partite.
// Piccolo e in cache; il browser lo scarica solo quando si apre la ricerca (brief 8).
export async function GET() {
  const [{ data: site }, { data: teams }] = await Promise.all([getSite(), getTeamsIndex()]);
  const bundles = (await Promise.all(site.editions.slice(0, 4).map((edition) => getEdition(edition.year)))).map((snapshot) => snapshot.data).filter((bundle): bundle is EditionBundle => bundle !== null);

  const entries: SearchEntry[] = teams
    .filter((team) => team.years.length > 0)
    .map((team) => ({ kind: 'team', label: team.name, detail: `${team.code} · ${team.years.join(', ')}`, href: `/squadre/${team.slug}` }));

  for (const bundle of bundles) {
    const year = bundle.edition.year;
    for (const team of bundle.teams) {
      for (const player of team.roster ?? []) {
        // Chi compare solo con il numero di maglia non è cercabile per nome.
        if (!player.hidden) entries.push({ kind: 'player', label: player.name, detail: `${team.name} · ${year}`, href: `/squadre/${team.slug}?edizione=${year}` });
      }
    }
    for (const match of bundle.matches) {
      if (!match.home || !match.away) continue;
      entries.push({
        kind: 'match',
        label: fmt(m.ics.summary, { home: match.home.name, away: match.away.name }),
        detail: `${match.label} · ${year}`,
        href: `/edizioni/${year}/partite/${match.id}`,
      });
    }
  }

  return Response.json(entries, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
