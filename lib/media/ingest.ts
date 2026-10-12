import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { media } from '@/db/schema';
import type { DataSource, MediaKind } from '@/db/schema/enums';
import type { Db } from '@/lib/data/db';
import { deletePrefix, putObject, variantKey } from './storage';

// Caricamento di un'immagine: si conserva l'originale in area privata e si preparano versioni
// leggere in WebP (brief 7.11 e 13.1). I metadati della foto (posizione GPS compresa) non
// finiscono mai nelle versioni pubblicate.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const PHOTO_WIDTHS = [480, 960, 1600];
export const LOGO_WIDTHS = [96, 240, 480];

const ACCEPTED: Record<MediaKind, string[]> = {
  photo: ['jpeg', 'png', 'webp'],
  crest: ['jpeg', 'png', 'webp', 'svg'],
  logo: ['jpeg', 'png', 'webp', 'svg'],
  document: [],
};

export class MediaError extends Error {
  constructor(public readonly code: 'tooLarge' | 'badType') {
    super(code);
    this.name = 'MediaError';
  }
}

export type IngestInput = {
  buffer: Buffer;
  kind: Exclude<MediaKind, 'document'>;
  alt?: string | null;
  caption?: string | null;
  credit?: string | null;
  editionId?: number | null;
  matchId?: number | null;
  containsMinors?: boolean;
  consentPublish?: boolean;
  uploadedBy?: number | null;
  /** Stemmi e loghi caricati dal titolare sono pubblici subito; le foto restano in bozza. */
  approvedBy?: number | null;
  approve?: boolean;
  source?: DataSource;
};

export async function ingestImage(db: Db, input: IngestInput): Promise<typeof media.$inferSelect> {
  if (input.buffer.byteLength > MAX_UPLOAD_BYTES) throw new MediaError('tooLarge');
  const { default: sharp } = await import('sharp');

  let format: string | undefined;
  try {
    format = (await sharp(input.buffer).metadata()).format;
  } catch {
    throw new MediaError('badType');
  }
  if (!format || !ACCEPTED[input.kind].includes(format)) throw new MediaError('badType');

  const prefix = `${input.kind}/${randomBytes(12).toString('hex')}`;
  // rotate() applica l'orientamento della fotocamera; l'uscita non porta con sé i metadati.
  const base = sharp(input.buffer, { density: format === 'svg' ? 300 : undefined }).rotate();
  const { width = 0, height = 0 } = await base.clone().toBuffer({ resolveWithObject: true }).then((result) => result.info);

  const targets = (input.kind === 'photo' ? PHOTO_WIDTHS : LOGO_WIDTHS).filter((target, index) => index === 0 || target <= width);
  const variants: number[] = [];
  for (const target of targets) {
    const resized = await base
      .clone()
      .resize({ width: Math.min(target, width || target), withoutEnlargement: format !== 'svg' })
      .webp({ quality: input.kind === 'photo' ? 72 : 90 })
      .toBuffer();
    await putObject(variantKey(prefix, target), resized);
    variants.push(target);
  }
  await putObject(`${prefix}/original`, input.buffer);

  const approved = input.approve === true;
  const [row] = await db
    .insert(media)
    .values({
      kind: input.kind,
      storageKey: prefix,
      mime: 'image/webp',
      width,
      height,
      variants,
      alt: input.alt ?? null,
      caption: input.caption ?? null,
      credit: input.credit ?? null,
      editionId: input.editionId ?? null,
      matchId: input.matchId ?? null,
      containsMinors: input.containsMinors ?? false,
      consentPublish: input.consentPublish ?? false,
      uploadedBy: input.uploadedBy ?? null,
      approvedBy: approved ? (input.approvedBy ?? input.uploadedBy ?? null) : null,
      approvedAt: approved ? new Date() : null,
      source: input.source ?? 'admin',
    })
    .returning();
  return row;
}

export async function deleteMedia(db: Db, id: number): Promise<void> {
  const [row] = await db.delete(media).where(eq(media.id, id)).returning();
  if (row?.storageKey) await deletePrefix(row.storageKey);
}

/** La versione più piccola che copre la larghezza richiesta. */
export function pickVariant(variants: number[], wanted: number): number | null {
  if (variants.length === 0) return null;
  const sorted = [...variants].sort((a, b) => a - b);
  return sorted.find((width) => width >= wanted) ?? sorted[sorted.length - 1];
}
