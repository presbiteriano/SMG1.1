import type { AdminRole } from '@/db/schema/enums';
import { can, type Permission } from '@/lib/auth/permissions';
import { isProduction } from '@/lib/env';
import { m } from '@/lib/i18n';

type Item = { href: string; label: string; permission: Permission | null };

const ITEMS: Item[] = [
  { href: '/admin', label: m.admin.nav.today, permission: null },
  { href: '/admin/partite', label: m.admin.nav.matches, permission: null },
  { href: '/admin/avvisi', label: m.admin.nav.announcements, permission: 'announcements.write' },
  { href: '/admin/iscrizioni', label: m.admin.nav.registrations, permission: 'registrations.read' },
  { href: '/admin/squadre', label: m.admin.nav.teams, permission: 'teams.write' },
  { href: '/admin/foto', label: m.admin.nav.photos, permission: 'media.upload' },
  { href: '/admin/sponsor', label: m.admin.nav.sponsors, permission: 'sponsors.write' },
  { href: '/admin/edizioni', label: m.admin.nav.editions, permission: 'editions.write' },
  { href: '/admin/albo', label: m.admin.nav.hall, permission: 'hall.write' },
  { href: '/admin/testi', label: m.admin.nav.documents, permission: 'documents.write' },
  { href: '/admin/importa', label: m.admin.nav.import, permission: 'import.write' },
  { href: '/admin/richieste', label: m.admin.nav.removals, permission: 'removals.write' },
  { href: '/admin/visite', label: m.admin.nav.analytics, permission: 'analytics.read' },
  { href: '/admin/registro', label: m.admin.nav.audit, permission: 'audit.read' },
  { href: '/admin/utenti', label: m.admin.nav.users, permission: 'users.write' },
  { href: '/admin/impostazioni', label: m.admin.nav.settings, permission: 'settings.write' },
  { href: '/admin/esempio', label: m.admin.nav.example, permission: 'example.write' },
];

/** Voci del pannello visibili al ruolo. I dati di esempio non compaiono mai in produzione. */
export function adminLinks(role: AdminRole): { href: string; label: string }[] {
  return ITEMS.filter((item) => item.permission === null || can(role, item.permission))
    .filter((item) => item.href !== '/admin/esempio' || !isProduction())
    .map(({ href, label }) => ({ href, label }));
}
