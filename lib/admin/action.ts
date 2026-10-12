import { desc, eq } from 'drizzle-orm';
import { editions } from '@/db/schema';
import { can, type Permission } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import type { AdminUser } from '@/lib/auth/store';
import { getDb, type Db } from '@/lib/data/db';
import { m } from '@/lib/i18n';

// Attrezzi comuni alle azioni del pannello: ogni azione controlla di nuovo sul server chi sta
// operando e che cosa può fare. I pulsanti nascosti nell'interfaccia non sono una protezione.

export type ActionState = {
  status: 'idle' | 'ok' | 'error' | 'confirm' | 'conflict';
  message?: string;
  errors?: Record<string, string>;
  /** Avvisi che chiedono una conferma prima di salvare. */
  warnings?: string[];
  extra?: Record<string, string>;
};

export const idle: ActionState = { status: 'idle' };
export const ok = (message: string = m.admin.common.saved, extra?: Record<string, string>): ActionState => ({ status: 'ok', message, extra });
export const failed = (message: string = m.admin.common.error, errors?: Record<string, string>): ActionState => ({ status: 'error', message, errors });

export type Authorized = { user: AdminUser; db: Db };

/** Chi non è entrato o non ha il permesso riceve un errore, non un'eccezione: il modulo lo mostra. */
export async function authorize(permission: Permission): Promise<Authorized | { denied: ActionState }> {
  const user = await getSessionUser();
  if (!user || !can(user.role, permission)) return { denied: failed(m.admin.common.forbidden) };
  return { user, db: await getDb() };
}

export const text = (data: FormData, key: string): string => String(data.get(key) ?? '').trim();
export const optional = (data: FormData, key: string): string | null => text(data, key) || null;
export const checked = (data: FormData, key: string): boolean => data.get(key) === 'on' || data.get(key) === 'true';

export function integer(data: FormData, key: string): number | null {
  const value = text(data, key);
  return /^-?\d{1,9}$/.test(value) ? Number(value) : null;
}

/** Edizione su cui si sta lavorando nel pannello: quella indicata, altrimenti la più recente (bozze comprese). */
export async function workingEdition(db: Db, requested: string | null | undefined) {
  const all = await db.select().from(editions).orderBy(desc(editions.year));
  const wanted = requested && /^\d{4}$/.test(requested) ? Number(requested) : null;
  return { all, current: all.find((edition) => edition.year === wanted) ?? all[0] ?? null };
}

export async function editionById(db: Db, id: number) {
  const [edition] = await db.select().from(editions).where(eq(editions.id, id)).limit(1);
  return edition ?? null;
}
