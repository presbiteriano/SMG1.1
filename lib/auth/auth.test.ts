import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminUsers } from '@/db/schema';
import { ADMIN_ROLES } from '@/db/schema/enums';
import { openEmbedded, type DbHandle } from '@/lib/data/db';
import { can, PERMISSIONS } from './permissions';
import { consumeLoginToken, createSession, deleteSession, findSessionUser, issueLoginToken, peekLoginToken } from './store';

describe('permessi per ruolo', () => {
  it('il titolare può fare tutto', () => {
    expect(PERMISSIONS.every((permission) => can('owner', permission))).toBe(true);
  });

  it('la redazione inserisce risultati, pubblica avvisi e gestisce le foto, ma non tocca il resto', () => {
    for (const permission of ['results.write', 'announcements.write', 'media.upload', 'media.approve'] as const) {
      expect(can('editor', permission), permission).toBe(true);
    }
    for (const permission of ['users.write', 'editions.write', 'settings.write', 'teams.write', 'registrations.write', 'export.read', 'import.write', 'example.write'] as const) {
      expect(can('editor', permission), permission).toBe(false);
    }
  });

  it('la sola lettura non modifica nulla', () => {
    const writes = PERMISSIONS.filter((permission) => permission.endsWith('.write') || permission === 'media.upload' || permission === 'media.approve');
    expect(writes.every((permission) => !can('viewer', permission))).toBe(true);
    expect(can('viewer', 'registrations.read')).toBe(true);
  });

  it('ogni ruolo previsto ha una riga nella matrice', () => {
    for (const role of ADMIN_ROLES) expect(typeof can(role, 'results.write')).toBe('boolean');
  });
});

describe('accesso con link via email', () => {
  let handle: DbHandle;
  const now = new Date('2027-06-07T18:00:00Z');

  beforeAll(async () => {
    handle = await openEmbedded();
    await handle.db.insert(adminUsers).values([
      { email: 'titolare@example.org', name: 'Titolare', role: 'owner' },
      { email: 'ex@example.org', name: 'Ex staff', role: 'editor', active: false },
    ]);
  });

  afterAll(async () => {
    await handle.close();
  });

  it('non crea link per indirizzi sconosciuti o disattivati', async () => {
    expect(await issueLoginToken(handle.db, 'nessuno@example.org', now)).toBeNull();
    expect(await issueLoginToken(handle.db, 'ex@example.org', now)).toBeNull();
  });

  it('il link vale una volta sola', async () => {
    const issued = await issueLoginToken(handle.db, ' Titolare@Example.org ', now);
    expect(issued?.user.role).toBe('owner');
    expect(await peekLoginToken(handle.db, issued!.token, now)).toBe(true);
    expect((await consumeLoginToken(handle.db, issued!.token, now))?.email).toBe('titolare@example.org');
    expect(await consumeLoginToken(handle.db, issued!.token, now)).toBeNull();
    expect(await peekLoginToken(handle.db, issued!.token, now)).toBe(false);
  });

  it('il link scade dopo 15 minuti', async () => {
    const issued = await issueLoginToken(handle.db, 'titolare@example.org', now);
    const late = new Date(now.getTime() + 16 * 60_000);
    expect(await consumeLoginToken(handle.db, issued!.token, late)).toBeNull();
  });

  it('un gettone inventato non apre nulla', async () => {
    expect(await consumeLoginToken(handle.db, 'gettone-inventato', now)).toBeNull();
    expect(await findSessionUser(handle.db, 'sessione-inventata', now)).toBeNull();
  });

  it('la sessione dura due settimane e si chiude con «Esci»', async () => {
    const issued = await issueLoginToken(handle.db, 'titolare@example.org', now);
    const user = await consumeLoginToken(handle.db, issued!.token, now);
    const session = await createSession(handle.db, user!.id, now);
    expect((await findSessionUser(handle.db, session.token, now))?.id).toBe(user!.id);
    expect(await findSessionUser(handle.db, session.token, new Date(now.getTime() + 15 * 86_400_000))).toBeNull();
    await deleteSession(handle.db, session.token);
    expect(await findSessionUser(handle.db, session.token, now)).toBeNull();
  });
});
