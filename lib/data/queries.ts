import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { siteSettings } from '@/db/schema';
import { loadPublicNumbers } from './analytics';
import { getDb, type Db } from './db';
import type { Snapshot } from './dto';
import { loadEditionBundle } from './edition-bundle';
import { loadDocument, loadGallery, loadHallOfFame, loadSiteBundle, loadTeamsIndex } from './site-bundle';

// Letture del sito pubblico, in cache per etichetta (brief 10 e 12.2). Quando l'admin salva,
// si invalida solo l'etichetta toccata (lib/data/invalidate.ts): niente rifacimento dell'intero sito.
//
// Modalità degradata: se il database non risponde si serve l'ultima versione buona, con l'ora
// in cui era stata generata («dati aggiornati alle HH:MM»). Mai pagina bianca.

type Stored<T> = { data: T; generatedAt: string };

const globalForCache = globalThis as unknown as { __smgLastGood?: Map<string, Stored<unknown>>; __smgEpoch?: Promise<string> };
const lastGood = (globalForCache.__smgLastGood ??= new Map());

/** Cambia quando il database viene ricreato: evita di servire la cache di un database che non c'è più. */
async function databaseEpoch(): Promise<string> {
  globalForCache.__smgEpoch ??= (async () => {
    try {
      const db = await getDb();
      const [row] = await db.select({ data: siteSettings.data }).from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
      return typeof row?.data?.db_epoch === 'string' ? row.data.db_epoch : 'default';
    } catch {
      globalForCache.__smgEpoch = undefined;
      return 'default';
    }
  })();
  return globalForCache.__smgEpoch;
}

type Key = string | number | null;

function cachedQuery<Args extends Key[], T>(
  name: string,
  tagsFor: (...args: Args) => string[],
  load: (db: Db, ...args: Args) => Promise<T>,
  revalidate: number | false = false,
) {
  return cache(async (...args: Args): Promise<Snapshot<T>> => {
    const key = [name, await databaseEpoch(), ...args.map(String)];
    const id = key.join(':');
    const run = unstable_cache(
      async (): Promise<Stored<T>> => ({ data: await load(await getDb(), ...args), generatedAt: new Date().toISOString() }),
      key,
      { tags: tagsFor(...args), revalidate },
    );
    try {
      const fresh = await run();
      lastGood.set(id, fresh);
      return { ...fresh, degraded: false };
    } catch (error) {
      const previous = lastGood.get(id) as Stored<T> | undefined;
      if (!previous) throw error;
      console.error(`[smg] database non raggiungibile: servo l'ultima versione di «${name}»`, error);
      return { ...previous, degraded: true };
    }
  });
}

export const getSite = cachedQuery('site', () => ['site', 'home'], (db) => loadSiteBundle(db));

const getEditionAny = cachedQuery(
  'edition',
  (year: number) => [`edition-${year}`, `standings-${year}`, 'matches'],
  (db, year: number) => loadEditionBundle(db, year),
);

/** Edizione per il sito pubblico: le bozze sono visibili solo dal pannello. */
export async function getEdition(year: number) {
  const snapshot = await getEditionAny(year);
  if (snapshot.data?.edition.status === 'draft') return { ...snapshot, data: null };
  return snapshot;
}

export const getTeamsIndex = cachedQuery('teams', () => ['teams'], (db) => loadTeamsIndex(db));

export const getGallery = cachedQuery(
  'gallery',
  (year: number | null) => (year === null ? ['media'] : ['media', `media-${year}`]),
  (db, year: number | null) => loadGallery(db, year),
);

export const getHallOfFame = cachedQuery('hall-of-fame', () => ['hall-of-fame'], (db) => loadHallOfFame(db), 86_400);

export const getDocument = cachedQuery(
  'document',
  (slug: string) => ['documents', `document-${slug}`],
  (db, slug: string) => loadDocument(db, slug),
);

export const getPublicNumbers = cachedQuery('numbers', () => ['numbers'], (db) => loadPublicNumbers(db, 30), 3_600);
