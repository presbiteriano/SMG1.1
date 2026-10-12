import { and, asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { openEmbedded, type DbHandle } from '@/lib/data/db';
import { loadEditionBundle } from '@/lib/data/edition-bundle';
import { createResultsProvider, MatchRuleViolation, undoLastMatchChange, VersionConflictError } from '@/lib/data/results-provider';
import { runRetention } from '@/lib/data/retention';
import { loadGallery, loadHallOfFame, loadSiteBundle, loadTeamsIndex } from '@/lib/data/site-bundle';
import { formatRome } from '@/lib/datetime';
import example from './example-edition-2027.json';
import { exampleEvents, exampleRosters, hasExampleData, purgeExample, seedExample } from './seed-example';

// Prova d'insieme su un database vero (PostgreSQL incorporato, in memoria): il seed passa dallo
// stesso punto d'ingresso del pannello, quindi qui si provano anche regole, versioni e registro.

let handle: DbHandle;

beforeAll(async () => {
  handle = await openEmbedded();
});

afterAll(async () => {
  await handle.close();
});

describe('edizione di esempio, torneo concluso', () => {
  beforeAll(async () => {
    await seedExample(handle.db, { phase: 'conclusa', withMedia: false });
  });

  it('le classifiche calcolate dal database coincidono con la sezione 18.4', async () => {
    const bundle = await loadEditionBundle(handle.db, 2027);
    expect(bundle).not.toBeNull();
    const groups = bundle!.competitions.flatMap((competition) => competition.stages.flatMap((stage) => stage.groups));
    expect(groups).toHaveLength(4);
    for (const group of groups) {
      const expected = example.expected.standings[group.name as 'A' | 'B' | 'C' | 'D'];
      expect(group.rows.map((row) => [row.team.code, row.points]), `girone ${group.name}`).toEqual(expected);
      expect(group.provisional).toBe(false);
      expect(group.rows.filter((row) => row.qualifies).map((row) => row.position)).toEqual([1, 2]);
    }
    const groupB = groups.find((group) => group.name === 'B');
    expect(groupB?.notes).toEqual([{ criterion: 'head_to_head_goal_diff', teamCodes: ['MOL', 'TRA', 'MAE'] }]);
  });

  it('il tabellone si riempie da solo: Porto Canale vince la Coppa, Faro Rovers la Supercoppa', async () => {
    const bundle = await loadEditionBundle(handle.db, 2027);
    expect(bundle!.cup?.winner.code).toBe(example.expected.cup_winner);
    expect(bundle!.cup?.runnerUp?.code).toBe('BAG');
    expect(bundle!.cup?.semifinalists.map((team) => team.code).sort()).toEqual(['FAR', 'VEB']);
    expect(bundle!.supercupWinner?.code).toBe(example.expected.supercup_winner);
    const quarter = bundle!.matches.find((match) => match.label === 'Quarto 2');
    expect(quarter).toMatchObject({ homeScore: 2, awayScore: 2, homePens: 4, awayPens: 3, decidedBy: 'penalties', winner: 'home' });
    expect(quarter?.home?.code).toBe('BAG');
  });

  it('numeri dell’edizione: 32 partite, 88 gol, 38 gialli, 2 rossi, una partita ai rigori', async () => {
    const { stats } = (await loadEditionBundle(handle.db, 2027))!;
    expect(stats).toMatchObject({ matchesPlayed: 32, goals: 88, yellow: 38, red: 2, shootouts: 1 });
    expect(stats.bestAttack.map((team) => [team.teamCode, team.value])).toEqual([['FAR', 7]]);
    // Il brief cita solo BAG, ma anche POC ha subito un gol nei gironi: a pari merito si mostrano entrambe.
    expect(stats.bestDefense.map((team) => [team.teamCode, team.value]).sort()).toEqual([
      ['BAG', 1],
      ['POC', 1],
    ]);
    expect(stats.mvps).toEqual([{ name: 'Mattia Rondoni', teamCode: 'POC', matchId: expect.any(Number), label: 'Finale' }]);
  });

  it('T9 - capocannonieri come nel brief, con il minorenne in forma abbreviata', async () => {
    const { stats } = (await loadEditionBundle(handle.db, 2027))!;
    expect(stats.topScorers.slice(0, 5).map((scorer) => ({ name: scorer.name, team: scorer.teamCode, goals: scorer.goals }))).toEqual(example.expected.top_scorers);
    expect(stats.topScorers.slice(5).every((scorer) => scorer.goals <= 2)).toBe(true);
  });

  it('T9 - nessun dato personale non pubblicabile esce dal database verso il sito', async () => {
    const bundle = (await loadEditionBundle(handle.db, 2027))!;
    const published = JSON.stringify(bundle);
    // Minorenni di Faro Rovers: solo nome e iniziale. Il maggiorenne che ha chiesto di non comparire: solo il numero.
    for (const surname of ['Venturelli', 'Ferrucci', 'Montanari', 'Pasini']) expect(published).not.toContain(surname);
    const far = bundle.teams.find((team) => team.code === 'FAR');
    expect(far?.roster?.map((player) => player.name)).toEqual([
      'Gianluca Brunelli',
      'Matteo Santorsi',
      'Davide F.',
      'Nicolò Baldelli',
      'Giocatore n. 5',
      'Simone Gaspari',
      'Federico Corbelli',
      'Andrea M.',
      'Lorenzo V.',
      'Riccardo Sacchetti',
    ]);
    // Minorenni senza liberatoria: mai il nome, in nessuna squadra.
    const rosters = exampleRosters();
    for (const [code, players] of rosters) {
      const shown = bundle.teams.find((team) => team.code === code)?.roster ?? [];
      for (const player of players.filter((item) => item.minor && item.consent !== 'received')) {
        expect(shown.find((item) => item.number === player.number)).toMatchObject({ name: `Giocatore n. ${player.number}`, hidden: true });
      }
    }
  });

  it('le rose di esempio hanno 160 persone, circa una su cinque minorenne', () => {
    const everyone = [...exampleRosters().values()].flat();
    expect(everyone).toHaveLength(160);
    const minors = everyone.filter((player) => player.minor);
    expect(minors.length).toBeGreaterThanOrEqual(30);
    expect(minors.length).toBeLessThanOrEqual(40);
    expect(minors.filter((player) => player.consent !== 'received')).toHaveLength(7);
    expect(new Set(everyone.map((player) => `${player.firstName} ${player.lastName}`)).size).toBe(160);
  });

  it('T8 - la partita a tavolino non ha marcatori', () => {
    const plan = exampleEvents().get('group:D:1:COR-ORM');
    expect(plan).toEqual({ goals: [], cards: [], mvp: null });
  });

  it('T7 - la partita rinviata è stata giocata una volta sola, il giorno dopo', async () => {
    const bundle = (await loadEditionBundle(handle.db, 2027))!;
    const replay = bundle.matches.find((match) => match.home?.code === 'VEB' && match.away?.code === 'SAL');
    expect(replay).toMatchObject({ status: 'finished', homeScore: 3, awayScore: 1 });
    expect(formatRome(replay!.kickoffAt!, 'dateTime')).toBe('11 giu, 19:15');
    const veb = bundle.competitions[0].stages[0].groups.find((group) => group.name === 'C')?.rows.find((row) => row.team.code === 'VEB');
    expect(veb?.played).toBe(3);
  });

  it('T12 - la prima partita è salvata alle 18:00 UTC e si mostra alle 20:00', async () => {
    const bundle = (await loadEditionBundle(handle.db, 2027))!;
    const first = bundle.matches[0];
    expect(first.kickoffAt).toBe('2027-06-07T18:00:00.000Z');
    expect(formatRome(first.kickoffAt!, 'time')).toBe('20:00');
    expect(first.label).toBe('Girone A · Giornata 1');
  });

  it('albo d’oro: il 2027 dalle partite, il 2026 dal solo vincitore inserito a mano', async () => {
    const hall = await loadHallOfFame(handle.db);
    expect(hall.map((row) => row.year)).toEqual([2027, 2026]);
    expect(hall[0]).toMatchObject({ hasDetails: true, cup: { winner: { name: 'Porto Canale' }, runnerUp: { name: 'Bagni Atletico' }, topScorer: { name: 'Lorenzo V.', goals: 6 } } });
    expect(hall[0].supercup.winner?.name).toBe('Faro Rovers');
    expect(hall[1]).toMatchObject({ hasDetails: false, cup: { winner: { name: 'Faro Rovers' }, runnerUp: null, topScorer: null } });
  });

  it('ogni riga dell’esempio porta source = example', async () => {
    const rows = await handle.db.select({ source: s.matches.source }).from(s.matches);
    expect(rows).toHaveLength(32);
    expect(rows.every((row) => row.source === 'example')).toBe(true);
    const site = await loadSiteBundle(handle.db);
    expect(site.hasExampleData).toBe(true);
    expect(site.featuredYear).toBe(2027);
    expect(site.sponsors.map((sponsor) => sponsor.name)).toEqual(example.sponsors.map((sponsor) => sponsor.name));
    // Un avviso scaduto non viene nemmeno caricato; quello futuro sì, e si filtra al momento di mostrarlo.
    expect(site.announcements.map((item) => item.title)).not.toContain('Sorteggio dei gironi');
    expect(site.announcements.map((item) => item.title)).toContain('Serata finale');
    expect((await loadTeamsIndex(handle.db)).length).toBe(16);
  });
});

describe('regole di scrittura dei risultati', () => {
  const provider = () => createResultsProvider(handle.db, 'admin', { userId: null });

  async function anyGroupMatch() {
    const [match] = await handle.db.select().from(s.matches).where(eq(s.matches.round, 1)).orderBy(asc(s.matches.id)).limit(1);
    return match;
  }

  it('T11 - due salvataggi sulla stessa versione: il secondo riceve un conflitto', async () => {
    const match = await anyGroupMatch();
    const first = await provider().upsertMatch({ id: match.id, expectedVersion: match.version, homeScore: 5, awayScore: 0, status: 'finished' });
    expect(first.version).toBe(match.version + 1);
    await expect(provider().upsertMatch({ id: match.id, expectedVersion: match.version, homeScore: 0, awayScore: 5, status: 'finished' })).rejects.toBeInstanceOf(VersionConflictError);
    const [stored] = await handle.db.select().from(s.matches).where(eq(s.matches.id, match.id));
    expect([stored.homeScore, stored.awayScore]).toEqual([5, 0]); // nessuna perdita silenziosa
  });

  it('ogni modifica a una partita lascia una riga nel registro, con il prima e il dopo', async () => {
    const match = await anyGroupMatch();
    const before = await handle.db.select().from(s.auditLog).where(and(eq(s.auditLog.entity, 'match'), eq(s.auditLog.entityId, String(match.id))));
    await provider().upsertMatch({ id: match.id, homeScore: 1, awayScore: 1, status: 'finished' });
    const after = await handle.db.select().from(s.auditLog).where(and(eq(s.auditLog.entity, 'match'), eq(s.auditLog.entityId, String(match.id))));
    expect(after.length).toBe(before.length + 1);
    const last = after.sort((a, b) => a.id - b.id).at(-1);
    expect(last).toMatchObject({ action: 'update', source: 'admin' });
    expect(last?.before).toMatchObject({ homeScore: 5, awayScore: 0 });
    expect(last?.after).toMatchObject({ homeScore: 1, awayScore: 1 });
  });

  it('«Annulla» riporta il risultato precedente come nuova versione', async () => {
    const match = await anyGroupMatch();
    const undone = await undoLastMatchChange(handle.db, match.id, { userId: null });
    expect(undone).toMatchObject({ homeScore: 5, awayScore: 0, version: match.version + 1 });
  });

  it('una partita finita richiede entrambi i punteggi', async () => {
    const match = await anyGroupMatch();
    await expect(provider().upsertMatch({ id: match.id, status: 'finished', homeScore: null, awayScore: 2 })).rejects.toMatchObject({ codes: ['scores_required'] });
  });

  it('una parità in una fase a eliminazione richiede i rigori', async () => {
    const [quarterStage] = await handle.db.select().from(s.stages).where(eq(s.stages.kind, 'quarter'));
    const [quarter] = await handle.db.select().from(s.matches).where(eq(s.matches.stageId, quarterStage.id)).limit(1);
    await expect(provider().upsertMatch({ id: quarter.id, status: 'finished', homeScore: 1, awayScore: 1, homePens: null, awayPens: null })).rejects.toBeInstanceOf(MatchRuleViolation);
    await expect(provider().upsertMatch({ id: quarter.id, status: 'finished', homeScore: 1, awayScore: 1, homePens: 3, awayPens: 3 })).rejects.toMatchObject({ codes: ['pens_required'] });
  });

  it('una squadra non può giocare due partite alla stessa ora e il campo non si sovrappone', async () => {
    const match = await anyGroupMatch();
    const [other] = await handle.db
      .select()
      .from(s.matches)
      .where(and(eq(s.matches.round, 2), eq(s.matches.groupId, match.groupId as number)))
      .orderBy(asc(s.matches.id))
      .limit(1);
    await expect(provider().upsertMatch({ id: other.id, kickoffAt: match.kickoffAt })).rejects.toMatchObject({ codes: expect.arrayContaining(['field_busy']) });
  });

  it('una partita riportata a «da giocare» perde il punteggio e la classifica torna provvisoria', async () => {
    const match = await anyGroupMatch();
    await provider().upsertMatch({ id: match.id, status: 'scheduled' });
    const bundle = (await loadEditionBundle(handle.db, 2027))!;
    const dto = bundle.matches.find((item) => item.id === match.id);
    expect(dto).toMatchObject({ status: 'scheduled', homeScore: null, awayScore: null });
    const group = bundle.competitions[0].stages[0].groups.find((item) => item.id === match.groupId);
    expect(group?.provisional).toBe(true); // T6
  });
});

describe('foto e consensi', () => {
  it('T10 - una foto non approvata non compare in galleria', async () => {
    const [edition] = await handle.db.select().from(s.editions).where(eq(s.editions.year, 2027));
    const base = { kind: 'photo' as const, storageKey: 'photo/test', width: 1600, height: 1067, variants: [480], alt: 'Campo', editionId: edition.id, source: 'example' as const };
    const now = new Date();
    await handle.db.insert(s.media).values([
      { ...base, caption: 'approvata', approvedAt: now },
      { ...base, caption: 'bozza' },
      { ...base, caption: 'respinta', approvedAt: now, rejectedAt: now },
      { ...base, caption: 'minorenni senza liberatoria', approvedAt: now, containsMinors: true, consentPublish: false },
      { ...base, caption: 'minorenni con liberatoria', approvedAt: now, containsMinors: true, consentPublish: true },
    ]);
    const gallery = await loadGallery(handle.db, 2027);
    expect(gallery.map((photo) => photo.caption).sort()).toEqual(['approvata', 'minorenni con liberatoria']);
    expect((await loadGallery(handle.db, 2026)).length).toBe(0);
  });
});

describe('conservazione dei dati', () => {
  it('cancella le iscrizioni 12 mesi dopo la fine dell’edizione e rende anonime le persone dopo 3 anni', async () => {
    const before = await handle.db.select().from(s.registrations);
    expect(before.length).toBe(20);

    const soon = await runRetention(handle.db, new Date('2028-01-01T00:00:00Z'));
    expect(soon.registrations).toBe(0);

    const later = await runRetention(handle.db, new Date('2028-06-20T00:00:00Z'));
    expect(later.registrations).toBe(20);
    expect(later.people).toBe(0);

    const muchLater = await runRetention(handle.db, new Date('2030-06-20T00:00:00Z'));
    expect(muchLater.people).toBe(160);
    const bundle = (await loadEditionBundle(handle.db, 2027))!;
    expect(JSON.stringify(bundle.teams)).not.toContain('Brunelli');
    expect(bundle.cup?.winner.code).toBe('POC'); // i risultati restano: è l'archivio sportivo
  });
});

describe('scenari e pulizia', () => {
  it('serata in corso: una rinviata, una finita, una in campo, una da giocare', async () => {
    await seedExample(handle.db, { phase: 'live', withMedia: false, now: new Date('2026-10-12T16:00:00Z') });
    const bundle = (await loadEditionBundle(handle.db, 2027))!;
    expect(bundle.edition.status).toBe('live');
    const tonight = bundle.matches.filter((match) => match.kickoffAt?.startsWith('2026-10-12'));
    expect(tonight.map((match) => `${match.home?.code}-${match.away?.code} ${match.status}`)).toEqual([
      'VEB-SAL postponed',
      'PIN-POC finished',
      'COR-SAB live',
      'LEV-ORM scheduled',
    ]);
    const groupC = bundle.competitions[0].stages[0].groups.find((group) => group.name === 'C');
    expect(groupC?.provisional).toBe(true);
    expect(groupC?.rows.find((row) => row.team.code === 'VEB')?.played).toBe(1); // T7: la rinviata non conta
    const quarter = bundle.matches.find((match) => match.label === 'Quarto 1');
    expect(quarter).toMatchObject({ home: null, homePlaceholder: 'Vincente girone A', awayPlaceholder: '2ª girone B' });
    const site = await loadSiteBundle(handle.db);
    expect(site.announcements.find((item) => item.severity === 'warning')?.title).toBe('Partita rinviata per pioggia');
  });

  it('iscrizioni aperte: dieci squadre confermate, nessuna partita', async () => {
    await seedExample(handle.db, { phase: 'iscrizioni', withMedia: false });
    const bundle = (await loadEditionBundle(handle.db, 2027))!;
    expect(bundle.edition.status).toBe('registrations_open');
    expect(bundle.teams).toHaveLength(10);
    expect(bundle.matches).toHaveLength(0);
    expect(new Date(bundle.edition.registrationCloseAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it('la pulizia toglie tutto l’esempio e lascia stare i dati veri', async () => {
    const [realTeam] = await handle.db.insert(s.teams).values({ slug: 'squadra-vera', name: 'Squadra Vera', shortCode: 'VER' }).returning();
    await purgeExample(handle.db, { keepUsers: false });
    expect(await hasExampleData(handle.db)).toBe(false);
    for (const table of [s.matches, s.teamEntries, s.people, s.registrations, s.announcements, s.sponsors, s.adminUsers, s.media]) {
      expect(await handle.db.select().from(table)).toHaveLength(0);
    }
    expect(await handle.db.select().from(s.teams)).toEqual([expect.objectContaining({ id: realTeam.id })]);
  });
});
