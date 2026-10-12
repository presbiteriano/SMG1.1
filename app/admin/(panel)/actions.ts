'use server';

import { desc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { adminUsers, announcements, documents, editions, groups, honours, registrations, removalRequests, siteSettings, stages, competitions, teamEntries, teams, tiebreakDecisions } from '@/db/schema';
import { ADMIN_ROLES, REGISTRATION_STATUSES, SEVERITIES, type AdminRole, type RegistrationStatus, type Severity } from '@/db/schema/enums';
import { isExamplePhase, purgeExample, seedExample } from '@/db/seed/seed-example';
import { authorize, checked, failed, integer, ok, optional, text, type ActionState } from '@/lib/admin/action';
import { normalizeEmail } from '@/lib/auth/store';
import { siteSettingsSchema } from '@/lib/config/site-settings';
import { writeAudit } from '@/lib/data/audit';
import type { Db } from '@/lib/data/db';
import { invalidate, invalidateEverything, tags } from '@/lib/data/invalidate';
import { advanceBracket } from '@/lib/data/results-provider';
import { romeDateKey, romeLocalToUtc } from '@/lib/datetime';
import { isProduction } from '@/lib/env';
import { m } from '@/lib/i18n';
import { slugify, suggestShortCode } from '@/lib/slug';

const HOUR = 3_600_000;

// --- Avvisi ------------------------------------------------------------------------------------

/** Pubblica un avviso: compare in cima a ogni pagina (scena 3 del brief). */
export async function publishAnnouncement(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('announcements.write');
  if ('denied' in auth) return auth.denied;
  const title = text(data, 'title');
  if (title.length < 3 || title.length > 120) return failed(m.admin.announcements.errors.title);
  const severity = (SEVERITIES as readonly string[]).includes(text(data, 'severity')) ? (text(data, 'severity') as Severity) : 'info';
  const link = optional(data, 'link');
  const now = new Date();
  const duration = text(data, 'duration');
  const endsAt =
    duration === 'tonight'
      ? romeLocalToUtc(romeDateKey(now), '23:59')
      : new Date(now.getTime() + (duration === 'week' ? 168 : duration === 'three' ? 72 : 24) * HOUR);

  const [created] = await auth.db
    .insert(announcements)
    .values({
      severity,
      title,
      body: optional(data, 'body')?.slice(0, 400) ?? null,
      // Solo collegamenti interni o https: niente indirizzi costruiti a mano.
      link: link && (link.startsWith('/') || /^https:\/\//i.test(link)) ? link.slice(0, 300) : null,
      startsAt: now,
      endsAt,
      editionId: integer(data, 'editionId'),
      createdBy: auth.user.id,
    })
    .returning();
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'announcement', entityId: created.id, action: 'create', after: { title, severity } });
  invalidate(tags.site());
  return ok(m.admin.announcements.published);
}

export async function endAnnouncement(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('announcements.write');
  if ('denied' in auth) return auth.denied;
  const id = integer(data, 'id');
  if (id === null) return failed();
  await auth.db.update(announcements).set({ endsAt: new Date() }).where(eq(announcements.id, id));
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'announcement', entityId: id, action: 'end' });
  invalidate(tags.site());
  return ok(m.admin.announcements.ended);
}

// --- Iscrizioni --------------------------------------------------------------------------------

async function uniqueSlug(db: Db, name: string): Promise<string> {
  const base = slugify(name) || 'squadra';
  const taken = new Set((await db.select({ slug: teams.slug }).from(teams)).map((row) => row.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}

export async function updateRegistration(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('registrations.write');
  if ('denied' in auth) return auth.denied;
  const id = integer(data, 'id');
  const status = text(data, 'status');
  if (id === null || !(REGISTRATION_STATUSES as readonly string[]).includes(status)) return failed();
  const [before] = await auth.db.select().from(registrations).where(eq(registrations.id, id)).limit(1);
  if (!before) return failed();

  await auth.db
    .update(registrations)
    .set({ status: status as RegistrationStatus, internalNotes: optional(data, 'internalNotes')?.slice(0, 1000) ?? null })
    .where(eq(registrations.id, id));
  // Nel registro finisce il cambio di stato, non i contatti del referente.
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'registration', entityId: id, action: 'update', before: { status: before.status }, after: { status } });

  if (checked(data, 'createTeam') && !before.teamId) {
    const [edition] = await auth.db.select().from(editions).where(eq(editions.id, before.editionId)).limit(1);
    const [team] = await auth.db
      .insert(teams)
      .values({ slug: await uniqueSlug(auth.db, before.teamName), name: before.teamName, shortCode: suggestShortCode(before.teamName) })
      .returning();
    await auth.db.insert(teamEntries).values({ editionId: before.editionId, teamId: team.id, status: 'confirmed' }).onConflictDoNothing();
    await auth.db.update(registrations).set({ teamId: team.id, status: 'accepted' }).where(eq(registrations.id, id));
    if (edition) invalidate(tags.edition(edition.year), tags.teams());
    return ok(m.admin.registrations.teamCreated);
  }
  return ok();
}

// --- Albo d'oro e testi --------------------------------------------------------------------------

export async function saveHonour(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('hall.write');
  if ('denied' in auth) return auth.denied;
  const editionId = integer(data, 'editionId');
  const competitionType = text(data, 'competitionType') === 'supercup' ? 'supercup' : 'cup';
  if (editionId === null) return failed();
  const values = {
    winnerTeamId: integer(data, 'winnerTeamId'),
    winnerName: optional(data, 'winnerName'),
    runnerUpTeamId: integer(data, 'runnerUpTeamId'),
    runnerUpName: optional(data, 'runnerUpName'),
    topScorerName: optional(data, 'topScorerName'),
    topScorerGoals: integer(data, 'topScorerGoals'),
  };
  await auth.db
    .insert(honours)
    .values({ editionId, competitionType, ...values })
    .onConflictDoUpdate({ target: [honours.editionId, honours.competitionType], set: values });
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'honour', entityId: `${editionId}:${competitionType}`, action: 'save', after: values });
  invalidate(tags.hall());
  return ok(m.admin.hall.saved);
}

export async function deleteHonour(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('hall.write');
  if ('denied' in auth) return auth.denied;
  const id = integer(data, 'id');
  if (id === null) return failed();
  await auth.db.delete(honours).where(eq(honours.id, id));
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'honour', entityId: id, action: 'delete' });
  invalidate(tags.hall());
  return ok(m.admin.hall.removed);
}

export async function saveDocument(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('documents.write');
  if ('denied' in auth) return auth.denied;
  const slug = text(data, 'slug');
  if (!/^[a-z-]{3,40}$/.test(slug)) return failed();
  const fileUrl = optional(data, 'fileUrl');
  const values = { title: text(data, 'title') || slug, body: String(data.get('body') ?? '').slice(0, 40_000), fileUrl: fileUrl && /^(https:\/\/|\/)/i.test(fileUrl) ? fileUrl : null, revisedAt: new Date() };
  const [current] = await auth.db.select().from(documents).where(eq(documents.slug, slug)).orderBy(desc(documents.revisedAt), desc(documents.id)).limit(1);
  if (current) await auth.db.update(documents).set(values).where(eq(documents.id, current.id));
  else await auth.db.insert(documents).values({ slug, ...values });
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'document', entityId: slug, action: 'save' });
  invalidate(tags.documents());
  return ok(m.admin.documents.saved);
}

// --- Impostazioni e utenti -----------------------------------------------------------------------

export async function saveSettings(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('settings.write');
  if ('denied' in auth) return auth.denied;
  const parsed = siteSettingsSchema.safeParse({
    instagram_url: text(data, 'instagram_url'),
    instagram_handle: text(data, 'instagram_handle'),
    whatsapp_url: text(data, 'whatsapp_url'),
    phones: text(data, 'phones')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean),
    contact_email: text(data, 'contact_email'),
    removal_email: text(data, 'removal_email'),
    maps_url: text(data, 'maps_url'),
    controller_name: text(data, 'controller_name'),
    legal_reviewed: checked(data, 'legal_reviewed'),
    consent_form_url: text(data, 'consent_form_url'),
    show_visit_numbers: checked(data, 'show_visit_numbers'),
  });
  if (!parsed.success) {
    const errors = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), m.admin.common.error]));
    return failed(m.admin.common.error, errors);
  }
  const [current] = await auth.db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  const next = { ...(current?.data ?? {}), ...parsed.data };
  await auth.db.insert(siteSettings).values({ id: 1, data: next }).onConflictDoUpdate({ target: siteSettings.id, set: { data: next, updatedAt: new Date() } });
  // I contatti sono dati personali: nel registro resta solo che cosa è cambiato, non i valori.
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'settings', entityId: 1, action: 'save', after: { fields: Object.keys(parsed.data) } });
  invalidate(tags.site());
  return ok(m.admin.settings.saved);
}

export async function saveUser(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('users.write');
  if ('denied' in auth) return auth.denied;
  const id = integer(data, 'id');
  const role = text(data, 'role');
  if (!(ADMIN_ROLES as readonly string[]).includes(role)) return failed();
  const active = id === null ? true : checked(data, 'active');

  if (id === null) {
    const email = normalizeEmail(text(data, 'email'));
    const name = text(data, 'name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2) return failed(m.admin.users.errors.email);
    const [existing] = await auth.db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
    if (existing) return failed(m.admin.users.errors.email);
    const [created] = await auth.db.insert(adminUsers).values({ email, name, role: role as AdminRole }).returning();
    await writeAudit(auth.db, { userId: auth.user.id, entity: 'admin_user', entityId: created.id, action: 'create', after: { role } });
    return ok(m.admin.users.saved);
  }

  // Deve sempre restare almeno un titolare attivo, e nessuno si toglie i permessi da solo.
  if (id === auth.user.id && (role !== 'owner' || !active)) return failed(m.admin.users.selfLock);
  const [before] = await auth.db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  if (!before) return failed();
  await auth.db.update(adminUsers).set({ role: role as AdminRole, active }).where(eq(adminUsers.id, id));
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'admin_user', entityId: id, action: 'update', before: { role: before.role, active: before.active }, after: { role, active } });
  return ok(m.admin.users.saved);
}

// --- Richieste di rimozione, sorteggio, dati di esempio --------------------------------------------

export async function handleRemoval(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('removals.write');
  if ('denied' in auth) return auth.denied;
  const id = integer(data, 'id');
  const status = text(data, 'status') === 'rejected' ? 'rejected' : 'done';
  if (id === null) return failed();
  await auth.db.update(removalRequests).set({ status, handledAt: new Date() }).where(eq(removalRequests.id, id));
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'removal_request', entityId: id, action: status });
  return ok();
}

/** Sorteggio: ultimo criterio di spareggio, decisione manuale registrata (brief 11.3). */
export async function saveTiebreak(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('results.write');
  if ('denied' in auth) return auth.denied;
  const groupId = integer(data, 'groupId');
  const parsed = z.array(z.number().int().positive()).min(2).max(16).safeParse(data.getAll('order').map(Number));
  if (groupId === null || !parsed.success || new Set(parsed.data).size !== parsed.data.length) return failed();

  const [row] = await auth.db
    .select({ editionId: competitions.editionId, year: editions.year })
    .from(groups)
    .innerJoin(stages, eq(stages.id, groups.stageId))
    .innerJoin(competitions, eq(competitions.id, stages.competitionId))
    .innerJoin(editions, eq(editions.id, competitions.editionId))
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!row) return failed();

  const values = { entryOrder: parsed.data, note: optional(data, 'note'), decidedBy: auth.user.id, decidedAt: new Date() };
  await auth.db.insert(tiebreakDecisions).values({ groupId, ...values }).onConflictDoUpdate({ target: tiebreakDecisions.groupId, set: values });
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'tiebreak', entityId: groupId, action: 'draw_lot', after: { entryOrder: parsed.data } });
  await advanceBracket(auth.db, row.editionId, { userId: auth.user.id }, 'admin');
  invalidate(tags.edition(row.year));
  return ok(m.admin.tiebreak.saved);
}

/** Ricrea da zero l'edizione di esempio nel momento del torneo scelto. Mai in produzione. */
export async function loadExample(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('example.write');
  if ('denied' in auth) return auth.denied;
  if (isProduction()) return failed(m.admin.example.disabled);
  const phase = text(data, 'phase');
  if (!isExamplePhase(phase)) return failed();
  const { years } = await seedExample(auth.db, { phase, keepUsers: true });
  invalidateEverything(years);
  return ok(m.admin.example.loaded);
}

export async function clearExample(_previous: ActionState, _data: FormData): Promise<ActionState> {
  void _data;
  const auth = await authorize('example.write');
  if ('denied' in auth) return auth.denied;
  // Gli utenti di esempio restano: altrimenti chi sta usando il pannello verrebbe buttato fuori.
  const years = await purgeExample(auth.db, { keepUsers: true });
  const others = await auth.db.select({ year: editions.year }).from(editions).where(ne(editions.status, 'draft'));
  invalidateEverything([...years, ...others.map((row) => row.year)]);
  return ok(m.admin.example.purged);
}
