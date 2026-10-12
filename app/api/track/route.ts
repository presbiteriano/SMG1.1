import { z } from 'zod';
import { classifyOrigin, normalizePath, recordEvent } from '@/lib/data/analytics';
import { getDb } from '@/lib/data/db';
import { clientKeyFrom, rateLimit } from '@/lib/rate-limit';

// Statistiche di visita senza cookie (brief 8 e 13.4). Si salvano solo contatori giornalieri:
// niente indirizzo IP, niente identificativi, niente dato individuale.

const schema = z.object({
  event: z.enum(['pageview', 'share']),
  path: z.string().max(300).optional(),
  entry: z.boolean().optional(),
  referrer: z.string().max(500).optional(),
  tag: z.string().max(60).optional(),
});

const done = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  // Solo richieste nate dalle nostre pagine: nessuno può gonfiare i numeri da un altro sito.
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return done();
  if (!rateLimit('track', clientKeyFrom(request.headers), 120, 60_000)) return done();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return done();
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return done();

  try {
    const db = await getDb();
    if (parsed.data.event === 'share') {
      await recordEvent(db, { event: 'share' });
    } else if (parsed.data.path?.startsWith('/') && !parsed.data.path.startsWith('/admin')) {
      await recordEvent(db, { event: 'pageview', key: normalizePath(parsed.data.path) });
      if (parsed.data.entry) await recordEvent(db, { event: 'entry', origin: classifyOrigin(parsed.data.referrer ?? null, parsed.data.tag ?? null) });
    }
  } catch (error) {
    console.error('[smg] visita non contata', error);
  }
  return done();
}
