import { hasServiceToken } from '@/lib/auth/service-token';
import { getDb } from '@/lib/data/db';
import { runRetention } from '@/lib/data/retention';

// Pulizia programmata (brief 13.9): da chiamare una volta al giorno con il gettone di servizio.
export async function POST(request: Request) {
  if (!hasServiceToken(request)) return new Response(null, { status: 401 });
  const report = await runRetention(await getDb());
  return Response.json({ ok: true, ...report });
}
