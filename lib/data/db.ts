import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from '@/db/schema';

// Il database del sito è la fonte di verità (brief 10). In produzione è PostgreSQL in regione UE
// (DATABASE_URL). Senza DATABASE_URL parte un PostgreSQL incorporato nella cartella .data/:
// serve per sviluppare e provare con l'edizione di esempio, senza installare nulla.

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type DbHandle = {
  db: Db;
  kind: 'postgres' | 'embedded';
  close: () => Promise<void>;
};

export const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');

export function dataDir(): string {
  return process.env.SMG_DATA_DIR || path.join(process.cwd(), '.data');
}

/** Apre un database incorporato; senza cartella vive solo in memoria (test). */
export async function openEmbedded(directory?: string): Promise<DbHandle> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  if (directory) mkdirSync(directory, { recursive: true });
  const client = new PGlite(directory);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db: db as unknown as Db, kind: 'embedded', close: () => client.close() };
}

async function openPostgres(url: string): Promise<DbHandle> {
  const { default: postgres } = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');
  // prepare: false per funzionare anche dietro un pooler di connessioni (Supabase, Neon).
  const client = postgres(url, { max: 5, prepare: false, onnotice: () => {} });
  return { db: drizzle(client, { schema }) as unknown as Db, kind: 'postgres', close: () => client.end() };
}

async function open(): Promise<DbHandle> {
  const url = process.env.DATABASE_URL;
  if (url) return openPostgres(url);

  const handle = await openEmbedded(path.join(dataDir(), 'pglite'));
  if (process.env.NODE_ENV !== 'production' && process.env.SMG_AUTO_SEED !== '0') {
    // Primo avvio in locale: carica l'edizione di esempio del brief, così il sito non è vuoto.
    const { ensureExampleData } = await import('@/db/seed/seed-example');
    await ensureExampleData(handle.db);
  }
  return handle;
}

const globalForDb = globalThis as unknown as { __smgDb?: Promise<DbHandle> };

export function getDbHandle(): Promise<DbHandle> {
  if (!globalForDb.__smgDb) {
    globalForDb.__smgDb = open().catch((error) => {
      globalForDb.__smgDb = undefined; // al prossimo tentativo si riprova a collegarsi
      throw error;
    });
  }
  return globalForDb.__smgDb;
}

export async function getDb(): Promise<Db> {
  return (await getDbHandle()).db;
}
