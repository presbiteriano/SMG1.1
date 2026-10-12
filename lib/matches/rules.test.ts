import { describe, expect, it } from 'vitest';
import { resolveSlots, type SlotMatch } from '@/lib/bracket/resolve';
import { classifyOrigin, normalizePath } from '@/lib/data/analytics';
import { canApproveMedia, isMediaPublic } from '@/lib/media/visibility';
import { normalizeMatchState, resultWarnings, validateMatchState, type MatchState } from './rules';

const state = (overrides: Partial<MatchState>): MatchState => ({
  status: 'scheduled',
  homeEntryId: 1,
  awayEntryId: 2,
  homeScore: null,
  awayScore: null,
  homePens: null,
  awayPens: null,
  ...overrides,
});

describe('regole di una partita', () => {
  it('una partita da giocare o rinviata non ha punteggio', () => {
    const next = normalizeMatchState(state({ status: 'postponed', homeScore: 2, awayScore: 1, homePens: 4, awayPens: 3 }), { knockout: true });
    expect(next).toMatchObject({ homeScore: null, awayScore: null, homePens: null, awayPens: null, decidedBy: null });
  });

  it('una partita in corso parte da 0-0', () => {
    expect(normalizeMatchState(state({ status: 'live' }), { knockout: false })).toMatchObject({ homeScore: 0, awayScore: 0 });
  });

  it('i rigori restano solo nelle eliminazioni finite in parità', () => {
    const knockoutDraw = normalizeMatchState(state({ status: 'finished', homeScore: 2, awayScore: 2, homePens: 4, awayPens: 3 }), { knockout: true });
    expect(knockoutDraw).toMatchObject({ homePens: 4, awayPens: 3, decidedBy: 'penalties' });
    const groupDraw = normalizeMatchState(state({ status: 'finished', homeScore: 2, awayScore: 2, homePens: 4, awayPens: 3 }), { knockout: false });
    expect(groupDraw).toMatchObject({ homePens: null, awayPens: null, decidedBy: 'regulation' });
    const knockoutWin = normalizeMatchState(state({ status: 'finished', homeScore: 3, awayScore: 2, homePens: 4, awayPens: 3 }), { knockout: true });
    expect(knockoutWin.homePens).toBeNull();
  });

  it('segnala ciò che non torna', () => {
    expect(validateMatchState(state({ status: 'finished', homeScore: 1 }), { knockout: false })).toEqual(['scores_required']);
    expect(validateMatchState(state({ status: 'finished', homeScore: 1, awayScore: 1 }), { knockout: true })).toEqual(['pens_required']);
    expect(validateMatchState(state({ status: 'finished', homeScore: 1, awayScore: 1 }), { knockout: false })).toEqual([]);
    expect(validateMatchState(state({ status: 'forfeited', homeScore: 0, awayScore: 0 }), { knockout: false })).toEqual(['scores_required']);
    expect(validateMatchState(state({ awayEntryId: 1 }), { knockout: false })).toEqual(['same_team']);
    expect(validateMatchState(state({ status: 'live', awayEntryId: null, homeScore: 0, awayScore: 0 }), { knockout: true })).toEqual(['teams_required']);
    expect(validateMatchState(state({ status: 'finished', homeScore: -1, awayScore: 0 }), { knockout: false })).toEqual(['negative']);
  });

  it('avvisa per punteggi molto alti e per correzioni dopo 24 ore', () => {
    const now = new Date('2027-06-09T20:00:00Z');
    const saved = { status: 'finished' as const, homeScore: 2, awayScore: 1, updatedAt: new Date('2027-06-07T20:00:00Z') };
    expect(resultWarnings({ before: null, next: { homeScore: 21, awayScore: 0 }, now })).toEqual(['high_score']);
    expect(resultWarnings({ before: saved, next: { homeScore: 3, awayScore: 1 }, now })).toEqual(['late_edit']);
    expect(resultWarnings({ before: saved, next: { homeScore: 2, awayScore: 1 }, now })).toEqual([]);
    expect(resultWarnings({ before: { ...saved, updatedAt: new Date('2027-06-09T19:00:00Z') }, next: { homeScore: 3, awayScore: 1 }, now })).toEqual([]);
  });
});

describe('tabellone derivato dalle partite', () => {
  const match = (overrides: Partial<SlotMatch> & { id: number }): SlotMatch => ({
    status: 'scheduled',
    homeEntryId: null,
    awayEntryId: null,
    homeSource: null,
    awaySource: null,
    homeScore: null,
    awayScore: null,
    homePens: null,
    awayPens: null,
    ...overrides,
  });

  const semis = [
    match({ id: 1, homeSource: { kind: 'group_rank', groupId: 10, rank: 1 }, awaySource: { kind: 'group_rank', groupId: 20, rank: 2 } }),
    match({ id: 2, homeSource: { kind: 'group_rank', groupId: 20, rank: 1 }, awaySource: { kind: 'group_rank', groupId: 10, rank: 2 } }),
    match({ id: 3, homeSource: { kind: 'match_winner', matchId: 1 }, awaySource: { kind: 'match_winner', matchId: 2 } }),
  ];
  const ranks: Record<string, number> = { '10:1': 101, '10:2': 102, '20:1': 201, '20:2': 202 };

  it('finché i gironi non sono decisi le caselle restano vuote', () => {
    expect(resolveSlots(semis, () => null)).toEqual([]);
  });

  it('a gironi chiusi entrano le qualificate', () => {
    expect(resolveSlots(semis, (groupId, rank) => ranks[`${groupId}:${rank}`] ?? null)).toEqual([
      { matchId: 1, homeEntryId: 101, awayEntryId: 202 },
      { matchId: 2, homeEntryId: 201, awayEntryId: 102 },
    ]);
  });

  it('chi vince passa al turno dopo, anche ai rigori', () => {
    const played = [
      match({ id: 1, status: 'finished', homeEntryId: 101, awayEntryId: 202, homeScore: 2, awayScore: 0 }),
      match({ id: 2, status: 'finished', homeEntryId: 201, awayEntryId: 102, homeScore: 1, awayScore: 1, homePens: 2, awayPens: 4 }),
      semis[2],
    ];
    expect(resolveSlots(played, () => null)).toEqual([{ matchId: 3, homeEntryId: 101, awayEntryId: 102 }]);
  });

  it('una partita già giocata non cambia squadre da sola', () => {
    const played = [match({ id: 1, status: 'finished', homeEntryId: 999, awayEntryId: 998, homeScore: 1, awayScore: 0, homeSource: { kind: 'group_rank', groupId: 10, rank: 1 } })];
    expect(resolveSlots(played, () => 101)).toEqual([]);
  });
});

describe('foto: chi può essere pubblicata', () => {
  const photo = { kind: 'photo', approvedAt: new Date(), rejectedAt: null, consentPublish: false, containsMinors: false };

  it('T10 - mai pubblica senza approvazione', () => {
    expect(isMediaPublic(photo)).toBe(true);
    expect(isMediaPublic({ ...photo, approvedAt: null })).toBe(false);
    expect(isMediaPublic({ ...photo, rejectedAt: new Date() })).toBe(false);
  });

  it('con minorenni riconoscibili serve la liberatoria, anche se qualcuno l’ha approvata per errore', () => {
    expect(canApproveMedia({ containsMinors: true, consentPublish: false })).toBe(false);
    expect(canApproveMedia({ containsMinors: true, consentPublish: true })).toBe(true);
    expect(isMediaPublic({ ...photo, containsMinors: true })).toBe(false);
    expect(isMediaPublic({ ...photo, containsMinors: true, consentPublish: true })).toBe(true);
  });
});

describe('statistiche di visita senza dati personali', () => {
  it('riconosce da dove arriva una visita', () => {
    expect(classifyOrigin('https://l.instagram.com/?u=x', null)).toBe('instagram');
    expect(classifyOrigin(null, 'ig')).toBe('instagram');
    expect(classifyOrigin('', 'wa')).toBe('whatsapp');
    expect(classifyOrigin('https://www.google.it/', null)).toBe('search');
    expect(classifyOrigin('https://example.org/pagina', null)).toBe('other');
    expect(classifyOrigin(null, null)).toBe('direct');
    expect(classifyOrigin('non-un-indirizzo', null)).toBe('direct');
  });

  it('gli indirizzi contati non contengono identificativi', () => {
    expect(normalizePath('/squadre/faro-rovers')).toBe('/squadre/[squadra]');
    expect(normalizePath('/edizioni/2027/partite/31?x=1')).toBe('/edizioni/2027/partite/[partita]');
    expect(normalizePath('/edizioni/2027/classifica/')).toBe('/edizioni/2027/classifica');
    expect(normalizePath('/')).toBe('/');
  });
});
