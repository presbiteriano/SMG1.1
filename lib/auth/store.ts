import { createHmac, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { adminSessions, adminUsers, loginTokens } from '@/db/schema';
import type { Db } from '@/lib/data/db';

// Accesso al pannello con link via email, senza password condivise (brief 9).
// Nel database restano solo le impronte dei gettoni: chi leggesse il database non potrebbe entrare.

export type AdminUser = typeof adminUsers.$inferSelect;

export const LOGIN_TOKEN_MINUTES = 15;
export const SESSION_DAYS = 14;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET mancante o troppo corto: impostalo nelle variabili d’ambiente.');
  return 'solo-per-sviluppo-locale';
}

export function hashToken(raw: string): string {
  return createHmac('sha256', secret()).update(raw).digest('hex');
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Crea un link di accesso per un utente attivo. Restituisce null se l'indirizzo non è abilitato. */
export async function issueLoginToken(db: Db, email: string, now: Date = new Date()): Promise<{ token: string; user: AdminUser } | null> {
  const [user] = await db
    .select()
    .from(adminUsers)
    .where(and(eq(adminUsers.email, normalizeEmail(email)), eq(adminUsers.active, true)))
    .limit(1);
  if (!user) return null;
  const token = newToken();
  await db.insert(loginTokens).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + LOGIN_TOKEN_MINUTES * 60_000),
  });
  return { token, user };
}

/** Controlla che il link sia valido senza consumarlo (la pagina di conferma lo mostra prima del tocco). */
export async function peekLoginToken(db: Db, token: string, now: Date = new Date()): Promise<boolean> {
  const [row] = await db
    .select({ id: loginTokens.id })
    .from(loginTokens)
    .where(and(eq(loginTokens.tokenHash, hashToken(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, now)))
    .limit(1);
  return Boolean(row);
}

/** Il link vale una volta sola: lo segna come usato e restituisce l'utente. */
export async function consumeLoginToken(db: Db, token: string, now: Date = new Date()): Promise<AdminUser | null> {
  const [used] = await db
    .update(loginTokens)
    .set({ usedAt: now })
    .where(and(eq(loginTokens.tokenHash, hashToken(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, now)))
    .returning();
  if (!used) return null;
  const [user] = await db
    .update(adminUsers)
    .set({ lastLoginAt: now })
    .where(and(eq(adminUsers.id, used.userId), eq(adminUsers.active, true)))
    .returning();
  return user ?? null;
}

export async function createSession(db: Db, userId: number, now: Date = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await db.insert(adminSessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function findSessionUser(db: Db, token: string, now: Date = new Date()): Promise<AdminUser | null> {
  const [row] = await db
    .select({ user: adminUsers })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.userId))
    .where(and(eq(adminSessions.id, hashToken(token)), gt(adminSessions.expiresAt, now), eq(adminUsers.active, true)))
    .limit(1);
  return row?.user ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(adminSessions).where(eq(adminSessions.id, hashToken(token)));
}

export async function purgeExpiredAuth(db: Db, now: Date = new Date()): Promise<void> {
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, now));
  await db.delete(loginTokens).where(lt(loginTokens.expiresAt, now));
}
