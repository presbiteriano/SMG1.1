import { redirect } from 'next/navigation';
import { getSite } from './queries';

/**
 * Indirizzi brevi /calendario, /classifica, /tabellone: portano alla stessa pagina dell'edizione
 * che ha partite (quella in primo piano, altrimenti l'ultima con dati). Servono alla barra inferiore
 * e ai link condivisi a voce; il selettore di edizione nel browser usa invece l'edizione ricordata.
 */
export async function redirectToEdition(section: 'calendario' | 'classifica' | 'tabellone'): Promise<never> {
  const { data: site } = await getSite();
  const featured = site.editions.find((edition) => edition.year === site.featuredYear);
  const year = featured && featured.matchCount > 0 ? featured.year : site.dataYear;
  redirect(year ? `/edizioni/${year}/${section}` : '/edizioni');
}
