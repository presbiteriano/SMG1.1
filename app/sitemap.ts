import type { MetadataRoute } from 'next';
import type { EditionBundle } from '@/lib/data/dto';
import { getEdition, getSite, getTeamsIndex } from '@/lib/data/queries';
import { siteUrl } from '@/lib/env';
import { editionHref } from '@/lib/site';

// Si genera a ogni richiesta: segue le edizioni e le partite che ci sono davvero, e la build non tocca il database.
export const dynamic = 'force-dynamic';

// Sitemap (brief 8): solo pagine pubbliche. Le foto non hanno indirizzi propri qui dentro,
// quindi una foto non approvata non può finirci (T10). Il pannello è escluso.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [{ data: site }, { data: teams }] = await Promise.all([getSite(), getTeamsIndex()]);
  const bundles = (await Promise.all(site.editions.map((edition) => getEdition(edition.year)))).map((snapshot) => snapshot.data).filter((bundle): bundle is EditionBundle => bundle !== null);

  const paths = new Set<string>(['/', '/edizioni', '/squadre', '/statistiche', '/albo-doro', '/sponsor', '/foto', '/regolamento', '/info', '/iscrizioni', '/privacy', '/cookie', '/rimozione-contenuti']);
  for (const edition of site.editions) paths.add(editionHref(edition));
  for (const bundle of bundles) {
    if (bundle.matches.length === 0) continue;
    const root = `/edizioni/${bundle.edition.year}`;
    paths.add(root);
    paths.add(`${root}/calendario`);
    paths.add(`${root}/classifica`);
    if (bundle.matches.some((match) => match.stageKind !== 'group')) paths.add(`${root}/tabellone`);
    for (const match of bundle.matches) paths.add(`${root}/partite/${match.id}`);
  }
  for (const team of teams) {
    if (team.years.length > 0) paths.add(`/squadre/${team.slug}`);
  }

  return [...paths].map((path) => ({ url: `${base}${path}`, changeFrequency: path.includes('/partite/') ? 'weekly' : 'daily' }));
}
