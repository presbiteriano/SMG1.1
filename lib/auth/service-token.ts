import { timingSafeEqual } from 'node:crypto';

/** Controlla il gettone dei servizi automatici (rigenerazione pagine, pulizia programmata). */
export function hasServiceToken(request: Request): boolean {
  const expected = process.env.REVALIDATE_TOKEN;
  if (!expected || expected.length < 16) return false;
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
