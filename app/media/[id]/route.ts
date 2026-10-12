import { eq } from 'drizzle-orm';
import { editions, media } from '@/db/schema';
import { getSessionUser } from '@/lib/auth/session';
import { getDb } from '@/lib/data/db';
import { pickVariant } from '@/lib/media/ingest';
import { getObject, variantKey } from '@/lib/media/storage';
import { isMediaPublic } from '@/lib/media/visibility';

// Unico indirizzo da cui escono foto, stemmi e loghi caricati. A ogni richiesta si ricontrolla
// l'approvazione: una foto non approvata, respinta o ritirata risponde 404 anche con il link diretto
// (brief 13.8, T10). Si legge sempre dal database, senza cache: una rimozione ha effetto subito.

const notFound = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) return notFound();

  const db = await getDb();
  const [row] = await db
    .select({ item: media, editionStatus: editions.status })
    .from(media)
    .leftJoin(editions, eq(editions.id, media.editionId))
    .where(eq(media.id, Number(id)))
    .limit(1);
  if (!row?.item.storageKey) return notFound();

  const isPublic = isMediaPublic(row.item) && row.editionStatus !== 'draft';
  // Chi lavora nel pannello vede anche le bozze, per poterle approvare.
  if (!isPublic && !(await getSessionUser())) return notFound();

  const wanted = Number(new URL(request.url).searchParams.get('w')) || 960;
  const width = pickVariant(row.item.variants ?? [], wanted);
  const data = width ? await getObject(variantKey(row.item.storageKey, width)) : null;
  if (!data) return notFound();

  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'image/webp',
      // Tempi brevi per le foto: se viene chiesta una rimozione, le copie in giro scadono in pochi minuti.
      'Cache-Control': !isPublic ? 'private, no-store' : row.item.kind === 'photo' ? 'public, max-age=300' : 'public, max-age=3600',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
