import { createHash } from 'node:crypto';

// Limitazione di frequenza per moduli e accesso (brief 13.3). I contatori vivono in memoria nel
// processo: bastano per un solo server. Con più istanze va spostata su un archivio condiviso.
// L'indirizzo di chi chiama non viene salvato: se ne tiene solo un'impronta, in memoria.

type Bucket = { count: number; resetAt: number };

const globalForLimits = globalThis as unknown as { __smgLimits?: Map<string, Bucket> };
const buckets = (globalForLimits.__smgLimits ??= new Map());

export function rateLimit(scope: string, clientKey: string, max: number, windowMs: number, now: number = Date.now()): boolean {
  // Solo fuori produzione: i test automatici entrano e inviano moduli molte volte di seguito.
  if (process.env.NODE_ENV !== 'production' && process.env.SMG_RATE_LIMIT === 'off') return true;
  const key = `${scope}:${createHash('sha256').update(clientKey).digest('hex').slice(0, 24)}`;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5_000) {
      for (const [other, value] of buckets) if (value.resetAt <= now) buckets.delete(other);
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}

/** Chiave del chiamante a partire dalle intestazioni della richiesta. */
export function clientKeyFrom(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip') || 'sconosciuto';
}
