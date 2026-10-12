import type { AdminRole } from '@/db/schema/enums';

// Ruoli del pannello (brief 9 e 13.6).
//   Titolare:     tutto.
//   Redazione:    risultati ed eventi, avvisi, caricare e approvare foto.
//   Sola lettura: vedere iscrizioni e dati, senza modificarli.

export const PERMISSIONS = [
  'results.write',
  'announcements.write',
  'media.upload',
  'media.approve',
  'registrations.read',
  'registrations.write',
  'teams.write',
  'calendar.write',
  'editions.write',
  'sponsors.write',
  'documents.write',
  'hall.write',
  'import.write',
  'settings.write',
  'users.write',
  'removals.write',
  'audit.read',
  'analytics.read',
  'export.read',
  'example.write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const EDITOR: Permission[] = ['results.write', 'announcements.write', 'media.upload', 'media.approve', 'registrations.read', 'audit.read'];
const VIEWER: Permission[] = ['registrations.read', 'analytics.read', 'audit.read'];

const MATRIX: Record<AdminRole, ReadonlySet<Permission>> = {
  owner: new Set(PERMISSIONS),
  editor: new Set(EDITOR),
  viewer: new Set(VIEWER),
};

export function can(role: AdminRole, permission: Permission): boolean {
  return MATRIX[role].has(permission);
}
