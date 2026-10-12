import { auditLog } from '@/db/schema';
import type { DataSource } from '@/db/schema/enums';
import type { Db } from './db';

// Cronologia di ogni modifica: chi, quando, valore prima e dopo (brief 9 e 11.1).

export type AuditEntry = {
  userId: number | null;
  entity: string;
  entityId: number | string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  source?: DataSource;
};

export async function writeAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    userId: entry.userId,
    entity: entry.entity,
    entityId: String(entry.entityId),
    action: entry.action,
    before: entry.before ?? null,
    after: entry.after ?? null,
    source: entry.source ?? 'admin',
  });
}
