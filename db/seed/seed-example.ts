import { randomBytes } from 'node:crypto';
import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import * as s from '@/db/schema';
import type { ConsentStatus, PlayerRole, PublishNameMode, Severity, SlotSource } from '@/db/schema/enums';
import type { Db } from '@/lib/data/db';
import { createResultsProvider, type MatchEventInput } from '@/lib/data/results-provider';
import { daysBetween, romeDateKey, romeLocalToUtc, shiftDateKey } from '@/lib/datetime';
import { deletePrefix } from '@/lib/media/storage';
import { slugify } from '@/lib/slug';
import example from './example-edition-2027.json';
import { crestSvg, photoSvg } from './example-art';

// Edizione di esempio del brief (sezione 18): 16 squadre inventate, 32 partite, rose, tabellone.
// Ogni riga creata qui porta source = 'example'. In produzione non si carica mai.
//
// I risultati passano dallo stesso punto d'ingresso del pannello (ResultsProvider): il seed è anche
// una prova generale di validazioni, versioni, registro delle modifiche e avanzamento del tabellone.

export const EXAMPLE_PHASES = ['iscrizioni', 'programma', 'live', 'gironi', 'conclusa'] as const;
export type ExamplePhase = (typeof EXAMPLE_PHASES)[number];

export function isExamplePhase(value: unknown): value is ExamplePhase {
  return (EXAMPLE_PHASES as readonly string[]).includes(value as string);
}

export const EXAMPLE_USERS = [
  { email: 'titolare@example.org', name: 'Titolare Esempio', role: 'owner' },
  { email: 'staff1@example.org', name: 'Staff Uno', role: 'editor' },
  { email: 'staff2@example.org', name: 'Staff Due', role: 'editor' },
  { email: 'socio@example.org', name: 'Socio Esempio', role: 'viewer' },
] as const;

const SOURCE = 'example' as const;

const anyOf = (column: AnyPgColumn, ids: (number | string)[]): SQL => (ids.length > 0 ? inArray(column, ids) : sql`false`);

/** Riga delle impostazioni con l'identificativo del database: serve alla cache per accorgersi se il database è stato ricreato. */
export async function ensureBaseSetup(db: Db): Promise<void> {
  const [row] = await db.select().from(s.siteSettings).where(eq(s.siteSettings.id, 1)).limit(1);
  if (!row) await db.insert(s.siteSettings).values({ id: 1, data: { db_epoch: randomBytes(8).toString('hex') } });
}

/** Primo avvio in locale con il database vuoto: carica l'edizione di esempio. */
export async function ensureExampleData(db: Db): Promise<void> {
  await ensureBaseSetup(db);
  const [any] = await db.select({ id: s.editions.id }).from(s.editions).limit(1);
  if (any) return;
  const phase = isExamplePhase(process.env.SMG_SEED_PHASE) ? process.env.SMG_SEED_PHASE : 'live';
  await seedExample(db, { phase });
}

export async function hasExampleData(db: Db): Promise<boolean> {
  const [row] = await db.select({ id: s.editions.id }).from(s.editions).where(eq(s.editions.source, SOURCE)).limit(1);
  return Boolean(row);
}

/** Cancella tutto ciò che appartiene all'esempio. I dati veri non vengono toccati. */
export async function purgeExample(db: Db, options: { keepUsers?: boolean } = {}): Promise<number[]> {
  const ids = async (query: Promise<{ id: number }[]>) => (await query).map((row) => row.id);

  const editionRows = await db.select().from(s.editions).where(eq(s.editions.source, SOURCE));
  const editionIds = editionRows.map((row) => row.id);
  const userIds = options.keepUsers ? [] : await ids(db.select({ id: s.adminUsers.id }).from(s.adminUsers).where(eq(s.adminUsers.source, SOURCE)));
  const matchIds = await ids(db.select({ id: s.matches.id }).from(s.matches).where(or(anyOf(s.matches.editionId, editionIds), eq(s.matches.source, SOURCE))));
  const competitionIds = await ids(db.select({ id: s.competitions.id }).from(s.competitions).where(anyOf(s.competitions.editionId, editionIds)));
  const stageIds = await ids(db.select({ id: s.stages.id }).from(s.stages).where(anyOf(s.stages.competitionId, competitionIds)));
  const groupIds = await ids(db.select({ id: s.groups.id }).from(s.groups).where(anyOf(s.groups.stageId, stageIds)));
  const entryIds = await ids(db.select({ id: s.teamEntries.id }).from(s.teamEntries).where(or(anyOf(s.teamEntries.editionId, editionIds), eq(s.teamEntries.source, SOURCE))));
  const sponsorIds = await ids(db.select({ id: s.sponsors.id }).from(s.sponsors).where(eq(s.sponsors.source, SOURCE)));
  const mediaRows = await db
    .select()
    .from(s.media)
    .where(or(eq(s.media.source, SOURCE), anyOf(s.media.editionId, editionIds), anyOf(s.media.matchId, matchIds)));
  const mediaIds = mediaRows.map((row) => row.id);

  await db.transaction(async (tx) => {
    await tx.delete(s.matchEvents).where(or(anyOf(s.matchEvents.matchId, matchIds), eq(s.matchEvents.source, SOURCE)));
    await tx.delete(s.auditLog).where(or(eq(s.auditLog.source, SOURCE), and(eq(s.auditLog.entity, 'match'), anyOf(s.auditLog.entityId, matchIds.map(String)))));
    await tx.delete(s.tiebreakDecisions).where(anyOf(s.tiebreakDecisions.groupId, groupIds));
    await tx.delete(s.registrations).where(or(anyOf(s.registrations.editionId, editionIds), eq(s.registrations.source, SOURCE)));
    await tx.delete(s.rosterEntries).where(or(anyOf(s.rosterEntries.teamEntryId, entryIds), eq(s.rosterEntries.source, SOURCE)));
    await tx.delete(s.people).where(and(eq(s.people.source, SOURCE), sql`not exists (select 1 from roster_entry r where r.person_id = ${s.people.id})`));

    // I file: prima si sciolgono i collegamenti, poi si cancellano le righe.
    await tx.update(s.editions).set({ heroMediaId: null }).where(or(anyOf(s.editions.heroMediaId, mediaIds), anyOf(s.editions.id, editionIds)));
    await tx.update(s.teams).set({ crestMediaId: null }).where(anyOf(s.teams.crestMediaId, mediaIds));
    await tx.update(s.sponsors).set({ logoMediaId: null }).where(anyOf(s.sponsors.logoMediaId, mediaIds));
    await tx.delete(s.media).where(anyOf(s.media.id, mediaIds));

    await tx.delete(s.matches).where(anyOf(s.matches.id, matchIds));
    await tx.delete(s.teamEntries).where(anyOf(s.teamEntries.id, entryIds));
    await tx.delete(s.honours).where(or(anyOf(s.honours.editionId, editionIds), eq(s.honours.source, SOURCE)));
    await tx.delete(s.teams).where(
      and(
        eq(s.teams.source, SOURCE),
        sql`not exists (select 1 from team_entry e where e.team_id = ${s.teams.id})`,
        sql`not exists (select 1 from honour h where h.winner_team_id = ${s.teams.id} or h.runner_up_team_id = ${s.teams.id})`,
        sql`not exists (select 1 from registration g where g.team_id = ${s.teams.id})`,
      ),
    );
    await tx.delete(s.sponsorEditions).where(or(anyOf(s.sponsorEditions.editionId, editionIds), anyOf(s.sponsorEditions.sponsorId, sponsorIds)));
    await tx.delete(s.sponsors).where(anyOf(s.sponsors.id, sponsorIds));
    await tx.delete(s.announcements).where(or(anyOf(s.announcements.editionId, editionIds), eq(s.announcements.source, SOURCE)));
    await tx.delete(s.documents).where(or(anyOf(s.documents.editionId, editionIds), eq(s.documents.source, SOURCE)));
    await tx.delete(s.removalRequests).where(eq(s.removalRequests.source, SOURCE));
    await tx.delete(s.groups).where(anyOf(s.groups.id, groupIds));
    await tx.delete(s.stages).where(anyOf(s.stages.id, stageIds));
    await tx.delete(s.competitions).where(anyOf(s.competitions.id, competitionIds));
    await tx.delete(s.editions).where(anyOf(s.editions.id, editionIds));
    await tx.delete(s.fields).where(and(eq(s.fields.source, SOURCE), sql`not exists (select 1 from match x where x.field_id = ${s.fields.id})`));
    await tx
      .delete(s.venues)
      .where(
        and(
          eq(s.venues.source, SOURCE),
          sql`not exists (select 1 from edition e where e.venue_id = ${s.venues.id})`,
          sql`not exists (select 1 from field f where f.venue_id = ${s.venues.id})`,
        ),
      );

    if (userIds.length > 0) {
      await tx.update(s.auditLog).set({ userId: null }).where(anyOf(s.auditLog.userId, userIds));
      await tx.update(s.matches).set({ updatedBy: null }).where(anyOf(s.matches.updatedBy, userIds));
      await tx.update(s.media).set({ uploadedBy: null }).where(anyOf(s.media.uploadedBy, userIds));
      await tx.update(s.media).set({ approvedBy: null }).where(anyOf(s.media.approvedBy, userIds));
      await tx.update(s.announcements).set({ createdBy: null }).where(anyOf(s.announcements.createdBy, userIds));
      await tx.update(s.tiebreakDecisions).set({ decidedBy: null }).where(anyOf(s.tiebreakDecisions.decidedBy, userIds));
      await tx.delete(s.loginTokens).where(anyOf(s.loginTokens.userId, userIds));
      await tx.delete(s.adminSessions).where(anyOf(s.adminSessions.userId, userIds));
      await tx.delete(s.adminUsers).where(anyOf(s.adminUsers.id, userIds));
    }
  });

  for (const row of mediaRows) {
    if (row.storageKey) await deletePrefix(row.storageKey);
  }
  return editionRows.map((row) => row.year);
}

// --- generazione deterministica di nomi e minuti: a ogni esecuzione lo stesso esempio -----------

function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = ['Alessandro', 'Luca', 'Marco', 'Tommaso', 'Filippo', 'Edoardo', 'Pietro', 'Giovanni', 'Nicola', 'Stefano', 'Daniele', 'Michele', 'Alberto', 'Emanuele', 'Cristian', 'Manuel', 'Jacopo', 'Elia', 'Diego', 'Enrico', 'Leonardo', 'Gabriele', 'Francesco', 'Alessio', 'Christian', 'Mirko', 'Denis', 'Thomas'];
const LAST_NAMES = ['Bertozzi', 'Casadei', 'Zoffoli', 'Lucchi', 'Pollini', 'Battistini', 'Garattoni', 'Bartolini', 'Severi', 'Tassinari', 'Mingozzi', 'Farneti', 'Abbondanza', 'Giorgini', 'Belletti', 'Campana', 'Righini', 'Fusconi', 'Paganelli', 'Sirri', 'Benini', 'Golinucci', 'Evangelisti', 'Magnani', 'Biondi', 'Turroni', 'Vicini', 'Zamagni', 'Pedrelli', 'Morigi', 'Gridelli', 'Bonoli'];
const ROLE_BY_NUMBER: Record<number, PlayerRole> = { 1: 'P', 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'C', 7: 'A', 8: 'C', 9: 'A', 10: 'C' };

type RosterSeed = { number: number; firstName: string; lastName: string; role: PlayerRole; minor: boolean; mode: PublishNameMode; consent: ConsentStatus };

/** Rose di esempio: 10 giocatori per squadra, circa uno su cinque minorenne (brief 18.1 e 13.7). */
export function exampleRosters(): Map<string, RosterSeed[]> {
  const random = prng(2027);
  const used = new Set<string>([
    ...example.roster_far.map((p) => `${p.first_name} ${p.last_name}`),
    ...example.stars.flatMap((star) => ('first_name' in star ? [`${star.first_name} ${star.last_name}`] : [])),
  ]);
  const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)];
  const rosters = new Map<string, RosterSeed[]>();

  example.teams.forEach((team, teamIndex) => {
    if (team.code === 'FAR') {
      rosters.set(
        team.code,
        example.roster_far.map((p) => ({
          number: p.number,
          firstName: p.first_name,
          lastName: p.last_name,
          role: p.role as PlayerRole,
          minor: p.minor,
          mode: p.mode as PublishNameMode,
          consent: p.consent as ConsentStatus,
        })),
      );
      return;
    }
    const star = example.stars.find((item) => item.team === team.code);
    const players: RosterSeed[] = [];
    for (let number = 1; number <= 10; number += 1) {
      let firstName = '';
      let lastName = '';
      if (star && 'first_name' in star && star.number === number) {
        firstName = star.first_name as string;
        lastName = star.last_name as string;
      } else {
        do {
          firstName = pick(FIRST_NAMES);
          lastName = pick(LAST_NAMES);
        } while (used.has(`${firstName} ${lastName}`));
        used.add(`${firstName} ${lastName}`);
      }
      // Minorenni: le maglie 3 e 8, più la 6 in una squadra su cinque. Sette senza liberatoria.
      const minor = number === 3 || number === 8 || (number === 6 && teamIndex % 5 === 0);
      const withoutConsent = minor && number === 8 && teamIndex % 2 === 0 && teamIndex <= 14;
      // Maggiorenni che hanno chiesto di non comparire: la maglia 5 di alcune squadre.
      const hiddenByChoice = !minor && number === 5 && teamIndex % 3 === 1;
      players.push({
        number,
        firstName,
        lastName,
        role: ROLE_BY_NUMBER[number],
        minor,
        mode: hiddenByChoice ? 'hidden' : minor ? 'initial' : 'full',
        consent: withoutConsent ? 'pending' : 'received',
      });
    }
    rosters.set(team.code, players);
  });
  return rosters;
}

type PlannedMatch = {
  key: string;
  kind: 'group' | 'quarter' | 'semi' | 'final' | 'supercup';
  evening: number;
  time: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  homePens: number | null;
  awayPens: number | null;
  forfeit: boolean;
  group?: string;
  round?: number;
  slot?: number;
  homeFrom?: string;
  awayFrom?: string;
  postponedTo?: { evening: number; time: string; reason: string };
  mvp?: { team: string; number: number };
};

function plannedMatches(): PlannedMatch[] {
  const groupMatches: PlannedMatch[] = example.group_matches.map((match) => ({
    key: `group:${match.group}:${match.round}:${match.home}-${match.away}`,
    kind: 'group',
    evening: match.evening,
    time: match.time,
    home: match.home,
    away: match.away,
    homeScore: match.home_score,
    awayScore: match.away_score,
    homePens: null,
    awayPens: null,
    forfeit: 'forfeit' in match && match.forfeit === true,
    group: match.group,
    round: match.round,
    postponedTo: 'postponed_to' in match ? match.postponed_to : undefined,
  }));
  const knockout: PlannedMatch[] = example.knockout.map((match) => ({
    key: `${match.stage}:${match.slot}`,
    kind: match.stage as PlannedMatch['kind'],
    evening: match.evening,
    time: match.time,
    home: match.home,
    away: match.away,
    homeScore: match.home_score,
    awayScore: match.away_score,
    homePens: 'home_pens' in match ? (match.home_pens ?? null) : null,
    awayPens: 'away_pens' in match ? (match.away_pens ?? null) : null,
    forfeit: false,
    slot: match.slot,
    homeFrom: match.home_from,
    awayFrom: match.away_from,
    mvp: 'mvp' in match ? match.mvp : undefined,
  }));
  const supercup: PlannedMatch = {
    key: 'supercup:1',
    kind: 'supercup',
    evening: example.supercup.evening,
    time: example.supercup.time,
    home: example.supercup.home,
    away: example.supercup.away,
    homeScore: example.supercup.home_score,
    awayScore: example.supercup.away_score,
    homePens: null,
    awayPens: null,
    forfeit: false,
    slot: 1,
    awayFrom: example.supercup.away_from,
  };
  return [...groupMatches, ...knockout, supercup];
}

/** Ordine in cui le partite si giocano davvero: il recupero di una rinviata conta dalla nuova data. */
function playOrder(match: PlannedMatch): number {
  const slot = match.postponedTo ?? match;
  const [hour, minute] = slot.time.split(':').map(Number);
  return slot.evening * 10_000 + hour * 100 + minute;
}

type GoalPlan = { team: string; number: number; minute: number };
type CardPlan = { team: string; number: number; minute: number; type: 'yellow' | 'red' };
type EventPlan = { goals: GoalPlan[]; cards: CardPlan[]; mvp: { team: string; number: number } | null };

/**
 * Marcatori dell'esempio: i capocannonieri dichiarati nel brief (18.6) segnano i gol indicati,
 * gli altri gol si distribuiscono tra i compagni senza che nessuno superi i due.
 */
export function exampleEvents(): Map<string, EventPlan> {
  const random = prng(88);
  const starLeft = new Map<string, { number: number; left: number }>(example.stars.map((star) => [star.team, { number: star.number, left: star.goals }]));
  const tally = new Map<string, number>();
  const rotation = [10, 7, 6, 8, 4, 2, 3, 5, 9];
  const cursor = new Map<string, number>();
  const out = new Map<string, EventPlan>();

  const nextOther = (team: string, starNumber: number | undefined): number => {
    for (let tries = 0; tries < 20; tries += 1) {
      const index = cursor.get(team) ?? 0;
      cursor.set(team, index + 1);
      const number = rotation[index % rotation.length];
      const count = tally.get(`${team}:${number}`) ?? 0;
      if (number !== starNumber && count < 2) {
        tally.set(`${team}:${number}`, count + 1);
        return number;
      }
    }
    return 10;
  };

  const minutes = (count: number): number[] => {
    const picked = new Set<number>();
    while (picked.size < count) picked.add(1 + Math.floor(random() * 30));
    return [...picked].sort((a, b) => a - b);
  };

  const ordered = [...plannedMatches()].sort((a, b) => playOrder(a) - playOrder(b));
  let cardIndex = 0;
  for (const match of ordered) {
    if (match.forfeit) {
      out.set(match.key, { goals: [], cards: [], mvp: null }); // a tavolino: nessun marcatore (T8)
      continue;
    }
    const scorersOf = (team: string, goals: number): { team: string; number: number }[] => {
      const star = starLeft.get(team);
      const list: { team: string; number: number }[] = [];
      for (let index = 0; index < goals; index += 1) {
        if (star && star.left > 0 && index % 2 === 0) {
          star.left -= 1;
          list.push({ team, number: star.number });
        } else {
          list.push({ team, number: nextOther(team, star?.number) });
        }
      }
      return list;
    };
    const homeScorers = scorersOf(match.home, match.homeScore);
    const awayScorers = scorersOf(match.away, match.awayScore);
    // I gol delle due squadre si alternano nel tempo, così il parziale di una partita in corso è credibile.
    const interleaved: { team: string; number: number }[] = [];
    for (let index = 0; index < Math.max(homeScorers.length, awayScorers.length); index += 1) {
      if (homeScorers[index]) interleaved.push(homeScorers[index]);
      if (awayScorers[index]) interleaved.push(awayScorers[index]);
    }
    const goalMinutes = minutes(interleaved.length);
    const goals = interleaved.map((scorer, index) => ({ ...scorer, minute: goalMinutes[index] }));

    const cards: CardPlan[] = [];
    const yellows = 1 + (cardIndex % 5 === 0 ? 1 : 0);
    for (let n = 0; n < yellows; n += 1) {
      const team = (cardIndex + n) % 2 === 0 ? match.home : match.away;
      cards.push({ team, number: 2 + ((cardIndex * 3 + n * 4) % 9), minute: 3 + ((cardIndex * 7 + n * 11) % 27), type: 'yellow' });
    }
    for (const red of example.red_cards) {
      if (red.match === match.key) cards.push({ team: red.team, number: red.number, minute: red.minute, type: 'red' });
    }
    cardIndex += 1;
    out.set(match.key, { goals, cards, mvp: match.mvp ?? null });
  }
  return out;
}

export type SeedOptions = {
  phase: ExamplePhase;
  now?: Date;
  /** Stemmi e foto di esempio generati al volo (richiede sharp). Nei test si salta. */
  withMedia?: boolean;
  keepUsers?: boolean;
};

export async function seedExample(db: Db, options: SeedOptions): Promise<{ years: number[] }> {
  if (process.env.NODE_ENV === 'production' && process.env.SMG_ALLOW_EXAMPLE !== '1') {
    throw new Error('I dati di esempio non si caricano in produzione.');
  }
  const { phase } = options;
  const now = options.now ?? new Date();
  const withMedia = options.withMedia ?? true;

  const removedYears = await purgeExample(db, { keepUsers: options.keepUsers ?? true });
  await ensureBaseSetup(db);

  for (const user of EXAMPLE_USERS) {
    await db.insert(s.adminUsers).values({ ...user, source: SOURCE }).onConflictDoNothing({ target: s.adminUsers.email });
  }
  const [owner] = await db.select().from(s.adminUsers).where(eq(s.adminUsers.email, EXAMPLE_USERS[0].email)).limit(1);

  // Nelle fasi «in corso» le date dell'esempio vengono spostate in modo che la serata sia oggi.
  const liveEvening = phase === 'live' ? 4 : phase === 'gironi' ? 6 : null;
  const shift = liveEvening ? daysBetween(example.evenings[liveEvening - 1], romeDateKey(now)) : 0;
  const evenings = example.evenings.map((day) => shiftDateKey(day, shift));
  const at = (evening: number, time: string) => romeLocalToUtc(evenings[evening - 1], time);
  const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

  const [venue] = await db.insert(s.venues).values({ name: example.venue.name, address: example.venue.address, source: SOURCE }).returning();
  const [field] = await db.insert(s.fields).values({ venueId: venue.id, name: example.venue.field, source: SOURCE }).returning();

  const status = phase === 'iscrizioni' ? 'registrations_open' : phase === 'programma' ? 'scheduled' : phase === 'conclusa' ? 'finished' : 'live';
  const closeDefault = romeLocalToUtc(shiftDateKey(example.edition.registration_close, shift), '23:59');
  const [edition] = await db
    .insert(s.editions)
    .values({
      year: example.edition.year,
      name: example.edition.name,
      status,
      startDate: evenings[0],
      endDate: evenings[evenings.length - 1],
      venueId: venue.id,
      registrationOpenAt: phase === 'iscrizioni' ? days(-10) : romeLocalToUtc(shiftDateKey(example.edition.registration_open, shift), '09:00'),
      registrationCloseAt: phase === 'iscrizioni' ? new Date(Math.max(closeDefault.getTime(), days(30).getTime())) : closeDefault,
      config: example.edition.config,
      source: SOURCE,
    })
    .returning();

  // Edizione precedente di cui si conosce solo il vincitore (brief 18.9).
  const [previous] = await db
    .insert(s.editions)
    .values({
      year: example.previous_edition.year,
      name: example.previous_edition.name,
      status: 'archived',
      startDate: example.previous_edition.start_date,
      endDate: example.previous_edition.end_date,
      venueId: venue.id,
      config: {},
      source: SOURCE,
    })
    .returning();

  // --- squadre, rose, iscrizioni -----------------------------------------------------------------
  const rosters = exampleRosters();
  const enrolled = phase === 'iscrizioni' ? example.teams.slice(0, 10) : example.teams;
  const teamIdByCode = new Map<string, number>();
  const entryIdByCode = new Map<string, number>();
  const rosterIdByKey = new Map<string, number>();

  for (const team of enrolled) {
    const [row] = await db
      .insert(s.teams)
      .values({ slug: slugify(team.name), name: team.name, shortCode: team.code, kitColor: team.kit_color, source: SOURCE })
      .onConflictDoUpdate({ target: s.teams.slug, set: { name: team.name, shortCode: team.code, kitColor: team.kit_color } })
      .returning();
    teamIdByCode.set(team.code, row.id);
    if (withMedia && team.crest) {
      const { ingestImage } = await import('@/lib/media/ingest');
      const crest = await ingestImage(db, { buffer: Buffer.from(crestSvg(team.kit_color, team.code)), kind: 'crest', alt: team.name, approve: true, approvedBy: owner.id, source: SOURCE });
      await db.update(s.teams).set({ crestMediaId: crest.id }).where(eq(s.teams.id, row.id));
    }
  }

  const farId = teamIdByCode.get(example.previous_edition.cup_winner);
  if (farId) {
    await db.insert(s.honours).values({ editionId: previous.id, competitionType: 'cup', winnerTeamId: farId, source: SOURCE });
  }

  const hasCalendar = phase !== 'iscrizioni';
  const groupIdByName = new Map<string, number>();
  let cupId = 0;
  let superId = 0;
  const stageIdByKind = new Map<string, number>();

  if (hasCalendar) {
    const [cup] = await db.insert(s.competitions).values({ editionId: edition.id, type: 'cup', name: 'Coppa', slug: 'coppa', order: 1, source: SOURCE }).returning();
    const [supercup] = await db.insert(s.competitions).values({ editionId: edition.id, type: 'supercup', name: 'Supercoppa', slug: 'supercoppa', order: 2, source: SOURCE }).returning();
    cupId = cup.id;
    superId = supercup.id;
    const stageSeeds = [
      { competitionId: cup.id, name: 'Gironi', kind: 'group', order: 1 },
      { competitionId: cup.id, name: 'Quarti di finale', kind: 'quarter', order: 2 },
      { competitionId: cup.id, name: 'Semifinali', kind: 'semi', order: 3 },
      { competitionId: cup.id, name: 'Finale', kind: 'final', order: 4 },
      { competitionId: supercup.id, name: 'Supercoppa', kind: 'single', order: 1 },
    ] as const;
    for (const seed of stageSeeds) {
      const [stage] = await db.insert(s.stages).values({ ...seed, source: SOURCE }).returning();
      stageIdByKind.set(seed.kind === 'single' ? 'supercup' : seed.kind, stage.id);
    }
    for (const [index, name] of ['A', 'B', 'C', 'D'].entries()) {
      const [group] = await db.insert(s.groups).values({ stageId: stageIdByKind.get('group') as number, name, order: index + 1, source: SOURCE }).returning();
      groupIdByName.set(name, group.id);
    }
  }

  for (const [index, team] of enrolled.entries()) {
    const teamId = teamIdByCode.get(team.code) as number;
    const [entry] = await db
      .insert(s.teamEntries)
      .values({ editionId: edition.id, teamId, groupId: hasCalendar ? (groupIdByName.get(team.group) ?? null) : null, seed: index + 1, status: 'confirmed', source: SOURCE })
      .returning();
    entryIdByCode.set(team.code, entry.id);
    for (const player of rosters.get(team.code) ?? []) {
      const [person] = await db
        .insert(s.people)
        .values({
          firstName: player.firstName,
          lastName: player.lastName,
          isMinor: player.minor,
          publishNameMode: player.mode,
          consentStatus: player.consent,
          consentRecordedAt: player.consent === 'received' ? days(-30) : null,
          source: SOURCE,
        })
        .returning();
      const [roster] = await db.insert(s.rosterEntries).values({ teamEntryId: entry.id, personId: person.id, shirtNumber: player.number, role: player.role, source: SOURCE }).returning();
      rosterIdByKey.set(`${team.code}:${player.number}`, roster.id);
    }
  }

  const registrationBase = { editionId: edition.id, contactName: 'Referente Esempio', contactPhone: '3XX XXXXXXX', contactEmail: 'referente@example.org', playersCount: 10, source: SOURCE } as const;
  for (const [index, team] of example.teams.entries()) {
    const accepted = teamIdByCode.has(team.code);
    await db.insert(s.registrations).values({
      ...registrationBase,
      teamName: team.name,
      hasMinors: true,
      kitColor: null,
      consentPrivacyAt: days(-40 + index),
      consentRulesAt: days(-40 + index),
      createdAt: days(-40 + index),
      status: accepted ? 'accepted' : index < 13 ? 'contacted' : 'new',
      teamId: teamIdByCode.get(team.code) ?? null,
    });
  }
  if (hasCalendar) {
    for (const [index, teamName] of example.waitlist.entries()) {
      await db.insert(s.registrations).values({ ...registrationBase, teamName, hasMinors: index % 2 === 0, consentPrivacyAt: days(-12 + index), consentRulesAt: days(-12 + index), createdAt: days(-12 + index), status: 'waitlist' });
    }
  }

  // --- sponsor, regolamento, avvisi --------------------------------------------------------------
  for (const [index, sponsor] of example.sponsors.entries()) {
    const [row] = await db.insert(s.sponsors).values({ name: sponsor.name, url: null, tier: 'standard', order: index + 1, source: SOURCE }).returning();
    await db.insert(s.sponsorEditions).values({ sponsorId: row.id, editionId: edition.id });
  }

  await db.insert(s.documents).values({
    slug: 'regolamento',
    editionId: edition.id,
    title: 'Regolamento',
    body: EXAMPLE_RULES,
    revisedAt: days(-45),
    source: SOURCE,
  });

  const announce = (severity: Severity, title: string, body: string, startsAt: Date, endsAt: Date | null, link: string | null = null) =>
    db.insert(s.announcements).values({ severity, title, body, startsAt, endsAt, link, editionId: edition.id, createdBy: owner.id, source: SOURCE });

  await announce('info', 'Sorteggio dei gironi', 'Il sorteggio si è svolto in diretta su Instagram.', days(-20), days(-12)); // scaduto
  await announce('info', 'Serata finale', 'Premiazioni a bordo campo subito dopo il fischio finale.', days(25), days(32)); // futuro
  const year = example.edition.year;
  if (phase === 'iscrizioni') await announce('info', 'Iscrizioni aperte', 'Posti limitati: 16 squadre. Compila il modulo in due minuti.', days(-1), days(20), '/iscrizioni');
  if (phase === 'programma') await announce('info', 'Calendario pubblicato', 'Gironi sorteggiati e orari fissati: cerca la tua squadra.', days(-1), days(10), `/edizioni/${year}/calendario`);
  if (phase === 'live') await announce('warning', 'Partita rinviata per pioggia', 'VEB-SAL si gioca domani alle 19:15.', new Date(now.getTime() - 3_600_000), days(1));
  if (phase === 'gironi') await announce('info', 'Domani i quarti di finale', 'Si comincia alle 20:00 con Faro Rovers - Molo Nord.', new Date(now.getTime() - 3_600_000), days(1), `/edizioni/${year}/tabellone`);
  if (phase === 'conclusa') await announce('info', 'Porto Canale vince la Coppa', 'Risultati, tabellone e foto restano qui, nell’archivio.', days(-1), days(14), `/edizioni/${year}/tabellone`);

  if (!hasCalendar) return { years: [...new Set([...removedYears, edition.year, previous.year])] };

  // --- partite: prima il calendario, poi i risultati nell'ordine in cui si giocano ----------------
  const provider = createResultsProvider(db, SOURCE);
  const planned = plannedMatches();
  const idByKey = new Map<string, number>();
  const entry = (code: string) => entryIdByCode.get(code) as number;

  const sourceFrom = (ref: string | undefined): SlotSource | null => {
    if (!ref) return null;
    if (ref.startsWith('W:')) {
      const [, stage, slot] = ref.split(':');
      return { kind: 'match_winner', matchId: idByKey.get(`${stage}:${slot}`) as number };
    }
    return { kind: 'group_rank', groupId: groupIdByName.get(ref.charAt(0)) as number, rank: Number(ref.slice(1)) };
  };

  for (const match of planned) {
    const base = { editionId: edition.id, kickoffAt: at(match.evening, match.time), fieldId: field.id, status: 'scheduled' as const };
    let created;
    if (match.kind === 'group') {
      created = await provider.upsertMatch({
        ...base,
        competitionId: cupId,
        stageId: stageIdByKind.get('group'),
        groupId: groupIdByName.get(match.group as string),
        round: match.round,
        homeEntryId: entry(match.home),
        awayEntryId: entry(match.away),
      });
    } else if (match.kind === 'supercup') {
      // Supercoppa: il campione dell'edizione precedente contro il vincitore della Coppa.
      created = await provider.upsertMatch({ ...base, competitionId: superId, stageId: stageIdByKind.get('supercup'), slot: 1, homeEntryId: entry(match.home), awaySource: sourceFrom(match.awayFrom) });
    } else {
      created = await provider.upsertMatch({
        ...base,
        competitionId: cupId,
        stageId: stageIdByKind.get(match.kind),
        slot: match.slot,
        homeSource: sourceFrom(match.homeFrom),
        awaySource: sourceFrom(match.awayFrom),
      });
    }
    idByKey.set(match.key, created.id);
  }

  if (phase === 'programma') return { years: [...new Set([...removedYears, edition.year, previous.year])] };

  const events = exampleEvents();
  const toInputs = (match: PlannedMatch, untilMinute: number): MatchEventInput[] => {
    const plan = events.get(match.key);
    if (!plan) return [];
    const inputs: MatchEventInput[] = [];
    for (const goal of plan.goals) {
      if (goal.minute <= untilMinute) inputs.push({ type: 'goal', minute: goal.minute, teamEntryId: entry(goal.team), rosterEntryId: rosterIdByKey.get(`${goal.team}:${goal.number}`) ?? null });
    }
    for (const card of plan.cards) {
      if (card.minute <= untilMinute) inputs.push({ type: card.type, minute: card.minute, teamEntryId: entry(card.team), rosterEntryId: rosterIdByKey.get(`${card.team}:${card.number}`) ?? null });
    }
    if (plan.mvp && untilMinute >= 30) inputs.push({ type: 'mvp', minute: null, teamEntryId: entry(plan.mvp.team), rosterEntryId: rosterIdByKey.get(`${plan.mvp.team}:${plan.mvp.number}`) ?? null });
    return inputs.sort((a, b) => (a.minute ?? 99) - (b.minute ?? 99));
  };

  // Fin dove si è giocato: tutto, i soli gironi, oppure la serata in corso a metà.
  const reached = (match: PlannedMatch): 'played' | 'live' | 'postponed' | 'todo' => {
    if (phase === 'conclusa') return 'played';
    if (phase === 'gironi') return match.kind === 'group' ? 'played' : 'todo';
    // Serata 4 in corso: una rinviata, una finita, una in campo, una da giocare.
    if (match.evening < 4) return 'played';
    if (match.evening > 4) return 'todo';
    if (match.postponedTo) return 'postponed';
    if (match.time === '20:45') return 'played';
    if (match.time === '21:30') return 'live';
    return 'todo';
  };

  for (const match of [...planned].sort((a, b) => playOrder(a) - playOrder(b))) {
    const id = idByKey.get(match.key) as number;
    const state = reached(match);
    if (state === 'todo') continue;

    if (match.postponedTo) {
      const reason = `Rinviata per ${match.postponedTo.reason}: si gioca il giorno dopo alle ${match.postponedTo.time}.`;
      await provider.upsertMatch({ id, status: 'postponed', note: reason });
      if (state === 'postponed') continue;
      await provider.upsertMatch({ id, status: 'scheduled', kickoffAt: at(match.postponedTo.evening, match.postponedTo.time), note: `Recupero della partita rinviata per ${match.postponedTo.reason}.` });
    }

    if (state === 'live') {
      const partial = toInputs(match, 15);
      const goalsOf = (code: string) => partial.filter((event) => event.type === 'goal' && event.teamEntryId === entry(code)).length;
      await provider.upsertMatch({ id, status: 'live', homeScore: goalsOf(match.home), awayScore: goalsOf(match.away) });
      await provider.upsertEvents(id, partial);
      continue;
    }

    // Prima del risultato si controlla che il tabellone abbia portato qui le squadre attese dal brief.
    const [row] = await db.select().from(s.matches).where(eq(s.matches.id, id)).limit(1);
    if (row.homeEntryId !== entry(match.home) || row.awayEntryId !== entry(match.away)) {
      throw new Error(`Esempio incoerente: in ${match.key} mi aspettavo ${match.home}-${match.away}.`);
    }
    await provider.upsertMatch({
      id,
      status: match.forfeit ? 'forfeited' : 'finished',
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      homePens: match.homePens,
      awayPens: match.awayPens,
    });
    const inputs = toInputs(match, 99);
    if (inputs.length > 0) await provider.upsertEvents(id, inputs);
  }

  if (withMedia) {
    try {
      await seedPhotos(db, edition.id, owner.id, idByKey.get('final:1') ?? null, phase === 'conclusa');
    } catch (error) {
      // Le foto di esempio sono un contorno: se non si riescono a generare, il resto dell'esempio resta valido.
      console.error('[smg] foto di esempio non generate', error);
    }
  }

  return { years: [...new Set([...removedYears, edition.year, previous.year])] };
}

/** Foto di esempio: immagini astratte senza persone, in tutti gli stati del flusso di consenso (brief 13.6). */
async function seedPhotos(db: Db, editionId: number, ownerId: number, finalMatchId: number | null, finalPlayed: boolean): Promise<void> {
  const { ingestImage } = await import('@/lib/media/ingest');
  const photos: { alt: string; caption: string; state: 'approved' | 'draft' | 'minors' | 'rejected'; match?: boolean }[] = [
    { alt: 'Il campo illuminato dai riflettori prima del calcio d’inizio', caption: 'Luci accese, si comincia.', state: 'approved' },
    { alt: 'La rete di una porta vista da dietro, con il campo sullo sfondo', caption: 'Dietro la porta.', state: 'approved' },
    { alt: 'Palloni in fila a bordo campo sotto le luci della sera', caption: 'Riscaldamento.', state: 'approved' },
    { alt: 'Il centrocampo visto dall’alto con le linee bianche', caption: 'Il cerchio di centrocampo.', state: 'approved' },
    { alt: 'Il campo a fine serata, con le luci ancora accese', caption: 'Fischio finale.', state: 'approved', match: true },
    { alt: 'Il tabellone luminoso a bordo campo', caption: 'In attesa di approvazione.', state: 'draft' },
    { alt: 'Foto di gruppo di una squadra', caption: 'Minorenni riconoscibili: manca la liberatoria.', state: 'minors' },
    { alt: 'Foto mossa della panchina', caption: 'Respinta.', state: 'rejected' },
  ];
  const { default: sharp } = await import('sharp');
  for (const [index, photo] of photos.entries()) {
    // Il caricamento foto accetta solo JPG, PNG e WebP, come per le foto vere: il disegno si converte prima.
    const buffer = await sharp(Buffer.from(photoSvg(index))).png().toBuffer();
    const row = await ingestImage(db, {
      buffer,
      kind: 'photo',
      alt: photo.alt,
      caption: photo.caption,
      credit: 'Archivio di esempio',
      editionId,
      matchId: photo.match && finalPlayed ? finalMatchId : null,
      containsMinors: photo.state === 'minors',
      consentPublish: false,
      uploadedBy: ownerId,
      approve: photo.state === 'approved',
      approvedBy: ownerId,
      source: SOURCE,
    });
    if (photo.state === 'rejected') await db.update(s.media).set({ rejectedAt: new Date() }).where(eq(s.media.id, row.id));
  }
}

const EXAMPLE_RULES = `## Regolamento di esempio
Questo testo è inventato e serve a mostrare la pagina. Il regolamento vero lo scrive il titolare del torneo.

## Formula
- 16 squadre in 4 gironi da 4: passano le prime due di ogni girone.
- Quarti, semifinali e finale a eliminazione diretta. Niente finale per il terzo posto.
- La Supercoppa è una partita unica tra il campione della Coppa e il campione dell'edizione precedente.

## In campo
- Calcetto a 7, due tempi da 15 minuti.
- Rosa da 8 a 12 giocatori.
- Nelle fasi a eliminazione, in caso di parità si va ai calci di rigore.

## Classifica
Tre punti per la vittoria, uno per il pareggio. A pari punti contano gli scontri diretti, poi la differenza reti.

## Quota
120 euro a squadra, da versare alla consegna della distinta.`;
