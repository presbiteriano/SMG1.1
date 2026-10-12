'use server';

import { eq } from 'drizzle-orm';
import { editions, media, sponsorEditions, sponsors, teams } from '@/db/schema';
import { authorize, checked, failed, integer, ok, optional, text, type ActionState } from '@/lib/admin/action';
import { writeAudit } from '@/lib/data/audit';
import type { Db } from '@/lib/data/db';
import { invalidate, tags } from '@/lib/data/invalidate';
import { m } from '@/lib/i18n';
import { deleteMedia, ingestImage, MediaError } from '@/lib/media/ingest';
import { canApproveMedia } from '@/lib/media/visibility';

// Foto, stemmi e loghi. Flusso del consenso (brief 13.6): chi carica indica se ci sono minorenni
// riconoscibili; la foto resta in bozza; solo l'approvazione la rende pubblica, e con minorenni
// senza liberatoria l'approvazione è impedita.

async function fileFrom(data: FormData, key: string): Promise<Buffer | null> {
  const file = data.get(key);
  if (!(file instanceof File) || file.size === 0) return null;
  return Buffer.from(await file.arrayBuffer());
}

const uploadError = (error: unknown): ActionState => {
  if (error instanceof MediaError) return failed(error.code === 'tooLarge' ? m.admin.photos.tooLarge : m.admin.photos.badType);
  console.error('[smg] caricamento fallito', error);
  return failed();
};

async function yearOf(db: Db, editionId: number | null): Promise<number | null> {
  if (editionId === null) return null;
  const [row] = await db.select({ year: editions.year }).from(editions).where(eq(editions.id, editionId)).limit(1);
  return row?.year ?? null;
}

/** Una foto per richiesta: il pannello le invia una dopo l'altra, così anche molte foto non pesano. */
export async function uploadPhoto(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('media.upload');
  if ('denied' in auth) return auth.denied;
  const buffer = await fileFrom(data, 'file');
  if (!buffer) return failed(m.admin.photos.badType);
  try {
    const row = await ingestImage(auth.db, {
      buffer,
      kind: 'photo',
      editionId: integer(data, 'editionId'),
      containsMinors: checked(data, 'containsMinors'),
      credit: optional(data, 'credit'),
      uploadedBy: auth.user.id,
    });
    await writeAudit(auth.db, { userId: auth.user.id, entity: 'media', entityId: row.id, action: 'upload', after: { containsMinors: row.containsMinors } });
  } catch (error) {
    return uploadError(error);
  }
  return ok();
}

export async function updatePhoto(_previous: ActionState, data: FormData): Promise<ActionState> {
  const intent = text(data, 'intent');
  const auth = await authorize(intent === 'save' ? 'media.upload' : 'media.approve');
  if ('denied' in auth) return auth.denied;
  const id = integer(data, 'id');
  const [before] = id === null ? [] : await auth.db.select().from(media).where(eq(media.id, id)).limit(1);
  if (!before || before.kind !== 'photo') return failed();

  const fields = {
    alt: optional(data, 'alt')?.slice(0, 200) ?? null,
    caption: optional(data, 'caption')?.slice(0, 200) ?? null,
    credit: optional(data, 'credit')?.slice(0, 120) ?? null,
    containsMinors: checked(data, 'containsMinors'),
    consentPublish: checked(data, 'consentPublish'),
    matchId: integer(data, 'matchId'),
  };

  let status: Partial<typeof media.$inferInsert> = {};
  if (intent === 'approve') {
    // Regola del brief: con minorenni riconoscibili senza liberatoria, il sistema impedisce l'approvazione.
    if (!canApproveMedia(fields)) return failed(m.admin.photos.blocked);
    if (!fields.alt) return failed(m.admin.photos.altRequired);
    status = { approvedAt: new Date(), approvedBy: auth.user.id, rejectedAt: null };
  } else if (intent === 'unpublish') {
    status = { approvedAt: null, approvedBy: null, rejectedAt: null };
  } else if (intent === 'reject') {
    status = { approvedAt: null, approvedBy: null, rejectedAt: new Date() };
  } else if (before.approvedAt && !canApproveMedia(fields)) {
    // Una foto già pubblica a cui si toglie la liberatoria torna subito in bozza.
    status = { approvedAt: null, approvedBy: null };
  }

  await auth.db.update(media).set({ ...fields, ...status }).where(eq(media.id, before.id));
  await writeAudit(auth.db, {
    userId: auth.user.id,
    entity: 'media',
    entityId: before.id,
    action: intent,
    before: { approved: Boolean(before.approvedAt), containsMinors: before.containsMinors, consentPublish: before.consentPublish },
    after: { approved: Boolean(status.approvedAt ?? (intent === 'save' && before.approvedAt && canApproveMedia(fields))), containsMinors: fields.containsMinors, consentPublish: fields.consentPublish },
  });
  invalidate(tags.media(await yearOf(auth.db, before.editionId)));
  return ok();
}

export async function saveTeamCrest(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('teams.write');
  if ('denied' in auth) return auth.denied;
  const teamId = integer(data, 'teamId');
  const buffer = await fileFrom(data, 'file');
  const [team] = teamId === null ? [] : await auth.db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team || !buffer) return failed(m.admin.photos.badType);
  try {
    // Stemmi e loghi li carica il titolare: sono pubblici subito.
    const row = await ingestImage(auth.db, { buffer, kind: 'crest', alt: team.name, uploadedBy: auth.user.id, approve: true });
    await auth.db.update(teams).set({ crestMediaId: row.id }).where(eq(teams.id, team.id));
    if (team.crestMediaId) await deleteMedia(auth.db, team.crestMediaId);
  } catch (error) {
    return uploadError(error);
  }
  invalidate(tags.teams(), ['matches', 'home']);
  return ok();
}

export async function saveSponsor(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('sponsors.write');
  if ('denied' in auth) return auth.denied;
  const id = integer(data, 'id');
  const name = text(data, 'name');
  const url = optional(data, 'url');
  if (name.length < 2) return failed();
  if (url && !/^https?:\/\/[^\s]+$/i.test(url)) return failed();
  const date = (key: string) => (/^\d{4}-\d{2}-\d{2}$/.test(text(data, key)) ? text(data, key) : null);
  const values = { name: name.slice(0, 80), url, tier: text(data, 'tier') || 'standard', order: integer(data, 'order') ?? 0, visibleFrom: date('visibleFrom'), visibleTo: date('visibleTo') };

  let sponsorId = id;
  if (id === null) {
    const [created] = await auth.db.insert(sponsors).values(values).returning();
    sponsorId = created.id;
  } else {
    await auth.db.update(sponsors).set(values).where(eq(sponsors.id, id));
  }
  if (sponsorId === null) return failed();

  const editionIds = data.getAll('editionIds').map(Number).filter((value) => Number.isInteger(value) && value > 0);
  await auth.db.delete(sponsorEditions).where(eq(sponsorEditions.sponsorId, sponsorId));
  if (editionIds.length > 0) await auth.db.insert(sponsorEditions).values(editionIds.map((editionId) => ({ sponsorId: sponsorId as number, editionId })));

  const buffer = await fileFrom(data, 'file');
  if (buffer) {
    try {
      const [before] = await auth.db.select().from(sponsors).where(eq(sponsors.id, sponsorId)).limit(1);
      const row = await ingestImage(auth.db, { buffer, kind: 'logo', alt: name, uploadedBy: auth.user.id, approve: true });
      await auth.db.update(sponsors).set({ logoMediaId: row.id }).where(eq(sponsors.id, sponsorId));
      if (before?.logoMediaId) await deleteMedia(auth.db, before.logoMediaId);
    } catch (error) {
      return uploadError(error);
    }
  }
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'sponsor', entityId: sponsorId, action: id === null ? 'create' : 'update', after: { name } });
  invalidate(tags.site());
  return ok(m.admin.sponsors.saved);
}

export async function deleteSponsor(_previous: ActionState, data: FormData): Promise<ActionState> {
  const auth = await authorize('sponsors.write');
  if ('denied' in auth) return auth.denied;
  const id = integer(data, 'id');
  if (id === null) return failed();
  const [row] = await auth.db.select().from(sponsors).where(eq(sponsors.id, id)).limit(1);
  if (!row) return failed();
  await auth.db.delete(sponsorEditions).where(eq(sponsorEditions.sponsorId, id));
  await auth.db.delete(sponsors).where(eq(sponsors.id, id));
  if (row.logoMediaId) await deleteMedia(auth.db, row.logoMediaId);
  await writeAudit(auth.db, { userId: auth.user.id, entity: 'sponsor', entityId: id, action: 'delete', before: { name: row.name } });
  invalidate(tags.site());
  return ok(m.admin.sponsors.removed);
}
