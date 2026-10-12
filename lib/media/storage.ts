import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from '@/lib/data/db';

// Archivio dei file caricati. Gli originali stanno fuori dalla cartella pubblica (brief 7.11):
// il sito li serve solo attraverso /media/[id], che controlla l'approvazione a ogni richiesta.
//
// Questa versione scrive su disco (MEDIA_DIR oppure .data/media): va bene in locale e su un server
// con disco persistente. Per un archivio oggetti in UE (Supabase Storage, Cloudflare R2) basta
// un secondo adattatore con le stesse tre funzioni.

export function mediaDir(): string {
  return process.env.MEDIA_DIR || path.join(dataDir(), 'media');
}

function resolveKey(key: string): string {
  if (!/^[a-z0-9][a-z0-9/_.-]*$/i.test(key) || key.includes('..')) throw new Error('chiave di archivio non valida');
  return path.join(mediaDir(), key);
}

export async function putObject(key: string, data: Buffer): Promise<void> {
  const file = resolveKey(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
}

export async function getObject(key: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveKey(key));
  } catch {
    return null;
  }
}

export async function deletePrefix(prefix: string): Promise<void> {
  await rm(resolveKey(prefix), { recursive: true, force: true });
}

export const variantKey = (prefix: string, width: number) => `${prefix}/w${width}.webp`;
