'use server';

import { and, eq, ne } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { editions, matchEvents, people, rosterEntries, teamEntries, teams } from '@/db/schema';
import { CONSENT_STATUSES, PLAYER_ROLES, PUBLISH_NAME_MODES, type ConsentStatus, type PlayerRole, type PublishNameMode } from '@/db/schema/enums';
import { authorize, checked, failed, integer, ok, optional, text, type ActionState } from '@/lib/admin/action';
import { writeAudit } from '@/lib/data/audit';
import { invalidate, tags } from '@/lib/data/invalidate';
import { advanceBracket } from '@/lib/data/results-provider';
import { m } from '@/lib/i18n';
import { defaultPublishMode } from '@/lib/people/display-name';
import { slugify } from '@/lib/slug';
import { isHexColor } from '@/lib/ui';

// Squadre e rose (brief 9): anagrafica, colori, rosa con numeri, liberatoria e forma del nome
// per ogni persona. Niente data di nascita: solo il flag «minorenne».

export async function saveTeam(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('teams.write');
  if ('denied' in auth) return auth.denied;
  const id = integer(data, 'id');
  const name = text(data, 'name');
  const shortCode = text(data, 'shortCode').toUpperCase();
  const kitColor = text(data, 'kitColor');
  const errors: Record<string, string> = {};
  if (name.length < 2 || name.length > 80) errors.name = m.admin.teams.errors.name;
  if (!/^[A-Z0-9]{3}$/.test(shortCode)) errors.shortCode = m.admin.teams.errors.shortCode;
  if (Object.keys(errors).length > 0) return failed(Object.values(errors).join(' '), errors);
  const values = { name, shortCode, kitColor: isHexColor(kitColor) ? kitColor : null };

  if (id === null) {
    const slug = slugify(name);
    const [taken] = await auth.db.select({ id: teams.id }).from(teams).where(eq(teams.slug, slug)).limit(1);
    if (!slug || taken) return failed(m.admin.teams.errors.slug, { name: m.admin.teams.errors.slug });
    const [created] = await auth.db.insert(teams).values({ slug, ...values }).returning();
    await writeAudit(auth.db, { userId: auth.user.id, entity: 'team', entityId: created.id, action: 'create', after: values });
    invalidate(tags.teams());
    redirect(`/admin/squadre/${created.id}`);
  }
  // L'indirizzo della squadra resta quello di prima anche se cambia il nome: i link devono durare anni.
  await auth.db.update(teams).set(values).where(eq(teams.id, id));
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'team', entityId: id, action: 'update', after: values });
  const years = await auth.db.select({ year: editions.year }).from(teamEntries).innerJoin(editions, eq(editions.id, teamEntries.editionId)).where(eq(teamEntries.teamId, id));
  invalidate(tags.teams(), ...years.map((row) => tags.edition(row.year)));
  return ok(m.admin.teams.saved);
}

/** Iscrive la squadra a un'edizione, la sposta di girone oppure la ritira. Una squadra con partite non si cancella. */
export async function saveEntry(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('teams.write');
  if ('denied' in auth) return auth.denied;
  const teamId = integer(data, 'teamId');
  const editionId = integer(data, 'editionId');
  if (teamId === null || editionId === null) return failed();
  const [edition] = await auth.db.select().from(editions).where(eq(editions.id, editionId)).limit(1);
  if (!edition) return failed();
  const groupId = integer(data, 'groupId');
  const status = text(data, 'status') === 'withdrawn' ? 'withdrawn' : 'confirmed';
  await auth.db
    .insert(teamEntries)
    .values({ teamId, editionId, groupId, status })
    .onConflictDoUpdate({ target: [teamEntries.editionId, teamEntries.teamId], set: { groupId, status } });
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'team_entry', entityId: `${editionId}:${teamId}`, action: 'save', after: { groupId, status } });
  await advanceBracket(auth.db, editionId, { userId: auth.user.id }, 'admin');
  invalidate(tags.edition(edition.year), tags.teams());
  return ok(m.admin.teams.saved);
}

export async function savePlayer(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('teams.write');
  if ('denied' in auth) return auth.denied;
  const rosterId = integer(data, 'rosterId');
  const entryId = integer(data, 'entryId');
  const firstName = text(data, 'firstName');
  const lastName = text(data, 'lastName');
  if (entryId === null || firstName.length < 1 || firstName.length > 60 || lastName.length > 60) return failed();

  const [entry] = await auth.db
    .select({ entry: teamEntries, year: editions.year })
    .from(teamEntries)
    .innerJoin(editions, eq(editions.id, teamEntries.editionId))
    .where(eq(teamEntries.id, entryId))
    .limit(1);
  if (!entry) return failed();

  const isMinor = checked(data, 'isMinor');
  const pick = <T extends string>(allowed: readonly T[], value: string, fallback: T): T => ((allowed as readonly string[]).includes(value) ? (value as T) : fallback);
  const consentStatus = pick<ConsentStatus>(CONSENT_STATUSES, text(data, 'consentStatus'), 'pending');
  const person = {
    firstName,
    lastName,
    isMinor,
    consentStatus,
    // Per un minorenne la forma di partenza è «Nome C.» (brief 7.5).
    publishNameMode: pick<PublishNameMode>(PUBLISH_NAME_MODES, text(data, 'publishNameMode'), defaultPublishMode(isMinor)),
    consentRecordedAt: consentStatus === 'received' ? new Date() : null,
  };
  const roster = { shirtNumber: integer(data, 'shirtNumber'), role: (PLAYER_ROLES as readonly string[]).includes(text(data, 'role')) ? (text(data, 'role') as PlayerRole) : null };

  if (rosterId === null) {
    const [created] = await auth.db.insert(people).values(person).returning();
    await auth.db.insert(rosterEntries).values({ teamEntryId: entryId, personId: created.id, ...roster });
    await writeAudit(auth.db, { userId: auth.user.id, entity: 'person', entityId: created.id, action: 'create', after: { isMinor, consentStatus, publishNameMode: person.publishNameMode } });
  } else {
    const [current] = await auth.db.select().from(rosterEntries).where(and(eq(rosterEntries.id, rosterId), eq(rosterEntries.teamEntryId, entryId))).limit(1);
    if (!current) return failed();
    const [before] = await auth.db.select().from(people).where(eq(people.id, current.personId)).limit(1);
    await auth.db.update(people).set(person).where(eq(people.id, current.personId));
    await auth.db.update(rosterEntries).set(roster).where(eq(rosterEntries.id, rosterId));
    // Nel registro finiscono le scelte su consenso e visibilità, non il nome della persona.
    await writeAudit(auth.db, {
      userId: auth.user.id,
      entity: 'person',
      entityId: current.personId,
      action: 'update',
      before: before ? { isMinor: before.isMinor, consentStatus: before.consentStatus, publishNameMode: before.publishNameMode } : null,
      after: { isMinor, consentStatus, publishNameMode: person.publishNameMode },
    });
  }
  invalidate(tags.edition(entry.year));
  return ok(m.admin.teams.playerSaved);
}

export async function removePlayer(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('teams.write');
  if ('denied' in auth) return auth.denied;
  const rosterId = integer(data, 'rosterId');
  if (rosterId === null) return failed();
  const [row] = await auth.db
    .select({ roster: rosterEntries, year: editions.year })
    .from(rosterEntries)
    .innerJoin(teamEntries, eq(teamEntries.id, rosterEntries.teamEntryId))
    .innerJoin(editions, eq(editions.id, teamEntries.editionId))
    .where(eq(rosterEntries.id, rosterId))
    .limit(1);
  if (!row) return failed();
  // I gol e i cartellini restano alla squadra: si scollega solo la persona.
  await auth.db.update(matchEvents).set({ rosterEntryId: null }).where(eq(matchEvents.rosterEntryId, rosterId));
  await auth.db.delete(rosterEntries).where(eq(rosterEntries.id, rosterId));
  const [other] = await auth.db.select({ id: rosterEntries.id }).from(rosterEntries).where(and(eq(rosterEntries.personId, row.roster.personId), ne(rosterEntries.id, rosterId))).limit(1);
  if (!other) await auth.db.delete(people).where(eq(people.id, row.roster.personId));
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'person', entityId: row.roster.personId, action: 'remove' });
  invalidate(tags.edition(row.year));
  return ok(m.admin.teams.playerRemoved);
}

export async function archiveTeam(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('teams.write');
  if ('denied' in auth) return auth.denied;
  const id = integer(data, 'id');
  if (id === null) return failed();
  const restore = optional(data, 'restore') === '1';
  // Cancellare una squadra con dati collegati è impedito: si archivia (brief 11.2).
  await auth.db.update(teams).set({ archivedAt: restore ? null : new Date() }).where(eq(teams.id, id));
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'team', entityId: id, action: restore ? 'restore' : 'archive' });
  invalidate(tags.teams());
  return ok(m.admin.teams.saved);
}
