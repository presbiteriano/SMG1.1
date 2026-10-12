import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import type {
  AdminRole,
  CompetitionType,
  ConsentStatus,
  DataSource,
  DecidedBy,
  EditionStatus,
  EntryStatus,
  MatchEventType,
  MatchStatus,
  MediaKind,
  PlayerRole,
  PublishNameMode,
  RegistrationStatus,
  RemovalStatus,
  RemovalSubject,
  Severity,
  SlotSource,
  StageKind,
} from './enums';

export * from './enums';

// Modello dei dati del brief (sezione 11.1). Ogni tabella ha la sicurezza per riga attiva e nessuna
// regola pubblica: solo il server del sito legge e scrive, mai il browser (brief 13.3).

const id = () => integer('id').primaryKey().generatedAlwaysAsIdentity();
const source = () => text('source').$type<DataSource>().notNull().default('admin');
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const instant = (name: string) => timestamp(name, { withTimezone: true });

export const venues = pgTable('venue', {
  id: id(),
  name: text('name').notNull(),
  address: text('address'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  mapsUrl: text('maps_url'),
  source: source(),
}).enableRLS();

export const fields = pgTable('field', {
  id: id(),
  venueId: integer('venue_id')
    .notNull()
    .references(() => venues.id),
  name: text('name').notNull(),
  source: source(),
}).enableRLS();

export const adminUsers = pgTable('admin_user', {
  id: id(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').$type<AdminRole>().notNull(),
  active: boolean('active').notNull().default(true),
  lastLoginAt: instant('last_login_at'),
  createdAt: createdAt(),
  source: source(),
}).enableRLS();

export const editions = pgTable('edition', {
  id: id(),
  year: integer('year').notNull().unique(),
  name: text('name').notNull(),
  status: text('status').$type<EditionStatus>().notNull().default('draft'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  venueId: integer('venue_id').references(() => venues.id),
  heroMediaId: integer('hero_media_id').references((): AnyPgColumn => media.id),
  registrationOpenAt: instant('registration_open_at'),
  registrationCloseAt: instant('registration_close_at'),
  rulesUrl: text('rules_url'),
  // Regole del torneo: punti, spareggi, gironi, qualificate... (brief 11.3). Mai nel codice.
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
  source: source(),
}).enableRLS();

export const competitions = pgTable(
  'competition',
  {
    id: id(),
    editionId: integer('edition_id')
      .notNull()
      .references(() => editions.id),
    type: text('type').$type<CompetitionType>().notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    order: integer('order').notNull().default(0),
    source: source(),
  },
  (t) => [uniqueIndex('competition_edition_slug').on(t.editionId, t.slug)],
).enableRLS();

export const stages = pgTable('stage', {
  id: id(),
  competitionId: integer('competition_id')
    .notNull()
    .references(() => competitions.id),
  name: text('name').notNull(),
  kind: text('kind').$type<StageKind>().notNull(),
  order: integer('order').notNull().default(0),
  source: source(),
}).enableRLS();

// «group» è una parola riservata in SQL: la tabella si chiama stage_group.
export const groups = pgTable('stage_group', {
  id: id(),
  stageId: integer('stage_id')
    .notNull()
    .references(() => stages.id),
  name: text('name').notNull(),
  order: integer('order').notNull().default(0),
  source: source(),
}).enableRLS();

export const teams = pgTable('team', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  shortCode: text('short_code').notNull(),
  crestMediaId: integer('crest_media_id').references((): AnyPgColumn => media.id),
  kitColor: text('kit_color'),
  archivedAt: instant('archived_at'),
  createdAt: createdAt(),
  source: source(),
}).enableRLS();

export const teamEntries = pgTable(
  'team_entry',
  {
    id: id(),
    editionId: integer('edition_id')
      .notNull()
      .references(() => editions.id),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    groupId: integer('group_id').references(() => groups.id),
    seed: integer('seed'),
    status: text('status').$type<EntryStatus>().notNull().default('confirmed'),
    source: source(),
  },
  (t) => [uniqueIndex('team_entry_edition_team').on(t.editionId, t.teamId)],
).enableRLS();

// Dati personali: niente data di nascita, solo il flag is_minor (brief 13.4).
export const people = pgTable('person', {
  id: id(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  isMinor: boolean('is_minor').notNull().default(false),
  publishNameMode: text('publish_name_mode').$type<PublishNameMode>().notNull().default('full'),
  consentStatus: text('consent_status').$type<ConsentStatus>().notNull().default('pending'),
  consentRecordedAt: instant('consent_recorded_at'),
  anonymizedAt: instant('anonymized_at'),
  createdAt: createdAt(),
  source: source(),
}).enableRLS();

export const rosterEntries = pgTable(
  'roster_entry',
  {
    id: id(),
    teamEntryId: integer('team_entry_id')
      .notNull()
      .references(() => teamEntries.id),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id),
    shirtNumber: integer('shirt_number'),
    role: text('role').$type<PlayerRole>(),
    source: source(),
  },
  (t) => [index('roster_entry_team_entry').on(t.teamEntryId)],
).enableRLS();

export const matches = pgTable(
  'match',
  {
    id: id(),
    editionId: integer('edition_id')
      .notNull()
      .references(() => editions.id),
    competitionId: integer('competition_id')
      .notNull()
      .references(() => competitions.id),
    stageId: integer('stage_id')
      .notNull()
      .references(() => stages.id),
    groupId: integer('group_id').references(() => groups.id),
    round: integer('round'),
    // Posizione nella fase: decide l'ordine nel tabellone (quarto 1, quarto 2...).
    slot: integer('slot'),
    homeEntryId: integer('home_entry_id').references(() => teamEntries.id),
    awayEntryId: integer('away_entry_id').references(() => teamEntries.id),
    homeSource: jsonb('home_source').$type<SlotSource>(),
    awaySource: jsonb('away_source').$type<SlotSource>(),
    kickoffAt: instant('kickoff_at'), // sempre UTC
    fieldId: integer('field_id').references(() => fields.id),
    status: text('status').$type<MatchStatus>().notNull().default('scheduled'),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    homePens: integer('home_pens'),
    awayPens: integer('away_pens'),
    decidedBy: text('decided_by').$type<DecidedBy>(),
    note: text('note'),
    version: integer('version').notNull().default(1),
    updatedBy: integer('updated_by').references(() => adminUsers.id),
    updatedAt: instant('updated_at').notNull().defaultNow(),
    archivedAt: instant('archived_at'),
    createdAt: createdAt(),
    source: source(),
  },
  (t) => [index('match_edition').on(t.editionId), index('match_kickoff').on(t.kickoffAt)],
).enableRLS();

export const matchEvents = pgTable(
  'match_event',
  {
    id: id(),
    matchId: integer('match_id')
      .notNull()
      .references(() => matches.id),
    type: text('type').$type<MatchEventType>().notNull(),
    minute: integer('minute'),
    rosterEntryId: integer('roster_entry_id').references(() => rosterEntries.id),
    teamEntryId: integer('team_entry_id')
      .notNull()
      .references(() => teamEntries.id),
    source: source(),
  },
  (t) => [index('match_event_match').on(t.matchId)],
).enableRLS();

export const sponsors = pgTable('sponsor', {
  id: id(),
  name: text('name').notNull(),
  logoMediaId: integer('logo_media_id').references((): AnyPgColumn => media.id),
  url: text('url'),
  tier: text('tier').notNull().default('standard'),
  visibleFrom: date('visible_from'),
  visibleTo: date('visible_to'),
  order: integer('order').notNull().default(0),
  source: source(),
}).enableRLS();

export const sponsorEditions = pgTable(
  'sponsor_edition',
  {
    sponsorId: integer('sponsor_id')
      .notNull()
      .references(() => sponsors.id),
    editionId: integer('edition_id')
      .notNull()
      .references(() => editions.id),
  },
  (t) => [primaryKey({ columns: [t.sponsorId, t.editionId] })],
).enableRLS();

// Mai pubblicato senza approved_at (brief 11.1 e 13.6).
export const media = pgTable(
  'media',
  {
    id: id(),
    kind: text('kind').$type<MediaKind>().notNull(),
    // Chiave del file nell'archivio privato: gli originali non stanno nella cartella pubblica.
    storageKey: text('storage_key'),
    // Indirizzo statico, solo per risorse non caricate (per esempio un PDF già in rete).
    url: text('url'),
    mime: text('mime'),
    width: integer('width'),
    height: integer('height'),
    variants: jsonb('variants').$type<number[]>(),
    alt: text('alt'),
    caption: text('caption'),
    credit: text('credit'),
    editionId: integer('edition_id').references((): AnyPgColumn => editions.id),
    matchId: integer('match_id').references((): AnyPgColumn => matches.id),
    consentPublish: boolean('consent_publish').notNull().default(false),
    containsMinors: boolean('contains_minors').notNull().default(false),
    uploadedBy: integer('uploaded_by').references(() => adminUsers.id),
    approvedBy: integer('approved_by').references(() => adminUsers.id),
    approvedAt: instant('approved_at'),
    rejectedAt: instant('rejected_at'),
    createdAt: createdAt(),
    source: source(),
  },
  (t) => [index('media_edition').on(t.editionId)],
).enableRLS();

export const announcements = pgTable('announcement', {
  id: id(),
  severity: text('severity').$type<Severity>().notNull().default('info'),
  title: text('title').notNull(),
  body: text('body'),
  startsAt: instant('starts_at').notNull(),
  endsAt: instant('ends_at'),
  link: text('link'),
  editionId: integer('edition_id').references(() => editions.id),
  createdBy: integer('created_by').references(() => adminUsers.id),
  createdAt: createdAt(),
  source: source(),
}).enableRLS();

// Dati personali dei referenti: cancellazione programmata 12 mesi dopo la fine dell'edizione (brief 13.9).
export const registrations = pgTable('registration', {
  id: id(),
  editionId: integer('edition_id')
    .notNull()
    .references(() => editions.id),
  teamName: text('team_name').notNull(),
  contactName: text('contact_name').notNull(),
  contactPhone: text('contact_phone').notNull(),
  contactEmail: text('contact_email').notNull(),
  playersCount: integer('players_count'),
  kitColor: text('kit_color'),
  hasMinors: boolean('has_minors').notNull().default(false),
  notes: text('notes'),
  consentPrivacyAt: instant('consent_privacy_at').notNull(),
  consentRulesAt: instant('consent_rules_at').notNull(),
  status: text('status').$type<RegistrationStatus>().notNull().default('new'),
  internalNotes: text('internal_notes'),
  teamId: integer('team_id').references(() => teams.id),
  createdAt: createdAt(),
  source: source(),
}).enableRLS();

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    userId: integer('user_id').references(() => adminUsers.id),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    before: jsonb('before').$type<Record<string, unknown> | null>(),
    after: jsonb('after').$type<Record<string, unknown> | null>(),
    at: instant('at').notNull().defaultNow(),
    source: source(),
  },
  (t) => [index('audit_entity').on(t.entity, t.entityId)],
).enableRLS();

export const loginTokens = pgTable('login_token', {
  id: id(),
  userId: integer('user_id')
    .notNull()
    .references(() => adminUsers.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: instant('expires_at').notNull(),
  usedAt: instant('used_at'),
  createdAt: createdAt(),
}).enableRLS();

export const adminSessions = pgTable('admin_session', {
  id: text('id').primaryKey(), // impronta del gettone, mai il gettone in chiaro
  userId: integer('user_id')
    .notNull()
    .references(() => adminUsers.id),
  expiresAt: instant('expires_at').notNull(),
  createdAt: createdAt(),
}).enableRLS();

// Albo d'oro inserito a mano, per le edizioni di cui si conosce solo il vincitore (brief 7.8).
export const honours = pgTable(
  'honour',
  {
    id: id(),
    editionId: integer('edition_id')
      .notNull()
      .references(() => editions.id),
    competitionType: text('competition_type').$type<'cup' | 'supercup'>().notNull(),
    winnerTeamId: integer('winner_team_id').references(() => teams.id),
    winnerName: text('winner_name'),
    runnerUpTeamId: integer('runner_up_team_id').references(() => teams.id),
    runnerUpName: text('runner_up_name'),
    topScorerName: text('top_scorer_name'),
    topScorerGoals: integer('top_scorer_goals'),
    source: source(),
  },
  (t) => [uniqueIndex('honour_edition_type').on(t.editionId, t.competitionType)],
).enableRLS();

// Sorteggio: decisione manuale registrata, ultimo criterio di spareggio (brief 11.3).
export const tiebreakDecisions = pgTable('tiebreak_decision', {
  id: id(),
  groupId: integer('group_id')
    .notNull()
    .unique()
    .references(() => groups.id),
  entryOrder: jsonb('entry_order').$type<number[]>().notNull(),
  note: text('note'),
  decidedBy: integer('decided_by').references(() => adminUsers.id),
  decidedAt: instant('decided_at').notNull().defaultNow(),
}).enableRLS();

// Testi lunghi gestiti dal titolare: regolamento, liberatoria... (mai nel codice).
export const documents = pgTable(
  'document',
  {
    id: id(),
    slug: text('slug').notNull(),
    editionId: integer('edition_id').references(() => editions.id),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    fileUrl: text('file_url'),
    revisedAt: instant('revised_at'),
    source: source(),
  },
  (t) => [index('document_slug').on(t.slug)],
).enableRLS();

export const removalRequests = pgTable('removal_request', {
  id: id(),
  subject: text('subject').$type<RemovalSubject>().notNull(),
  reference: text('reference').notNull(),
  requesterRole: text('requester_role'),
  contactEmail: text('contact_email').notNull(),
  message: text('message'),
  status: text('status').$type<RemovalStatus>().notNull().default('new'),
  handledAt: instant('handled_at'),
  createdAt: createdAt(),
  source: source(),
}).enableRLS();

// Statistiche di visita: solo conteggi giornalieri aggregati, nessun dato individuale (brief 13.4).
export const analyticsDaily = pgTable(
  'analytics_daily',
  {
    day: date('day').notNull(),
    event: text('event').notNull(),
    key: text('key').notNull().default(''),
    origin: text('origin').notNull().default(''),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.event, t.key, t.origin] })],
).enableRLS();

// Impostazioni del sito modificabili dal pannello: contatti, link, titolare del trattamento.
export const siteSettings = pgTable('site_setting', {
  id: integer('id').primaryKey(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}).enableRLS();
