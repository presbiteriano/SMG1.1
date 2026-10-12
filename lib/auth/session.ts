import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getDb } from '@/lib/data/db';
import { can, type Permission } from './permissions';
import { createSession, deleteSession, findSessionUser, type AdminUser } from './store';

// Sessione del pannello: un solo cookie tecnico, non leggibile da JavaScript.

const COOKIE = 'smg_admin';

export const getSessionUser = cache(async (): Promise<AdminUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return findSessionUser(await getDb(), token);
});

/** Per le pagine del pannello: chi non è entrato viene mandato alla pagina di accesso. */
export async function requireUser(): Promise<AdminUser> {
  const user = await getSessionUser();
  if (!user) redirect('/admin/accedi');
  return user;
}

/** Per le pagine riservate a un ruolo: chi non può torna alla prima pagina del pannello. */
export async function requirePermission(permission: Permission): Promise<AdminUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect('/admin');
  return user;
}

export async function startSession(userId: number): Promise<void> {
  const { token, expiresAt } = await createSession(await getDb(), userId);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await deleteSession(await getDb(), token);
  store.delete(COOKIE);
}
