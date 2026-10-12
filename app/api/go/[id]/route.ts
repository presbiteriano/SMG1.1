import { eq } from 'drizzle-orm';
import { sponsors } from '@/db/schema';
import { recordEvent } from '@/lib/data/analytics';
import { getDb } from '@/lib/data/db';

// Click su uno sponsor: si conta (senza cookie) e si prosegue verso il suo sito.
// La destinazione arriva solo dal database, mai dall'indirizzo: non è un reindirizzamento aperto.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) return new Response(null, { status: 404 });
  const db = await getDb();
  const [sponsor] = await db.select().from(sponsors).where(eq(sponsors.id, Number(id))).limit(1);
  if (!sponsor?.url || !/^https?:\/\//i.test(sponsor.url)) return new Response(null, { status: 404 });
  try {
    await recordEvent(db, { event: 'sponsor_click', key: String(sponsor.id) });
  } catch (error) {
    console.error('[smg] click sponsor non contato', error);
  }
  return new Response(null, { status: 302, headers: { Location: sponsor.url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
