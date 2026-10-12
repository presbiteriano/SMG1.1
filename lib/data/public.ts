import { notFound } from 'next/navigation';
import { parseYear } from '@/lib/site';
import type { EditionBundle, Snapshot } from './dto';
import { getEdition } from './queries';

/** Edizione dell'indirizzo /edizioni/[anno]/...: se non esiste (o è in bozza) la pagina è un 404. */
export async function requireEdition(yearParam: string): Promise<Snapshot<EditionBundle>> {
  const year = parseYear(yearParam);
  if (!year) notFound();
  const snapshot = await getEdition(year);
  if (!snapshot.data) notFound();
  return { ...snapshot, data: snapshot.data };
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Primo valore di un parametro dell'indirizzo, ripulito. */
export function param(params: Record<string, string | string[] | undefined>, key: string): string | null {
  const value = params[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first && first.length <= 80 ? first : null;
}
