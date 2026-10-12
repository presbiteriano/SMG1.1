import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { hasServiceToken } from '@/lib/auth/service-token';

// Rigenerazione delle pagine per etichetta dall'esterno (brief 12.1), per esempio dopo un'importazione
// fatta da riga di comando. Il pannello non passa da qui: invalida da solo ciò che modifica.
//   curl -X POST -H "Authorization: Bearer $REVALIDATE_TOKEN" -d '{"tags":["edition-2027"]}' https://.../api/revalidate

const schema = z.object({ tags: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).min(1).max(20) });

export async function POST(request: Request) {
  if (!hasServiceToken(request)) return new Response(null, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  for (const tag of parsed.data.tags) revalidateTag(tag, 'max');
  return Response.json({ ok: true, tags: parsed.data.tags });
}
