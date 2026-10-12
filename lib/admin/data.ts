import { buildEditionBundle } from '@/lib/data/edition-bundle';
import { fetchEditionRaw } from '@/lib/data/edition-raw';
import type { Db } from '@/lib/data/db';

/** Edizione letta direttamente dal database, senza cache: nel pannello si lavora sempre sul dato vero. */
export async function adminEdition(db: Db, editionId: number) {
  const raw = await fetchEditionRaw(db, editionId);
  return raw ? { raw, bundle: buildEditionBundle(raw) } : null;
}
