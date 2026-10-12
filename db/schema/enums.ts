// Valori ammessi per i campi a scelta chiusa (brief 11.1). Usati dallo schema, dalla validazione e dall'interfaccia.

export const EDITION_STATUSES = ['draft', 'announced', 'registrations_open', 'scheduled', 'live', 'finished', 'archived'] as const;
export type EditionStatus = (typeof EDITION_STATUSES)[number];

export const COMPETITION_TYPES = ['league_groups', 'knockout', 'cup', 'supercup'] as const;
export type CompetitionType = (typeof COMPETITION_TYPES)[number];

export const STAGE_KINDS = ['group', 'round_of_16', 'quarter', 'semi', 'final', 'third_place', 'single'] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export const MATCH_STATUSES = ['scheduled', 'live', 'finished', 'postponed', 'cancelled', 'forfeited'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const DECIDED_BY = ['regulation', 'penalties', 'forfeit'] as const;
export type DecidedBy = (typeof DECIDED_BY)[number];

export const EVENT_TYPES = ['goal', 'own_goal', 'yellow', 'red', 'mvp'] as const;
export type MatchEventType = (typeof EVENT_TYPES)[number];

export const ENTRY_STATUSES = ['registered', 'confirmed', 'withdrawn'] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const PUBLISH_NAME_MODES = ['full', 'initial', 'hidden'] as const;
export type PublishNameMode = (typeof PUBLISH_NAME_MODES)[number];

export const CONSENT_STATUSES = ['pending', 'received', 'denied'] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const PLAYER_ROLES = ['P', 'D', 'C', 'A'] as const;
export type PlayerRole = (typeof PLAYER_ROLES)[number];

export const MEDIA_KINDS = ['photo', 'crest', 'logo', 'document'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const SEVERITIES = ['info', 'warning', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const REGISTRATION_STATUSES = ['new', 'contacted', 'accepted', 'waitlist', 'rejected'] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const ADMIN_ROLES = ['owner', 'editor', 'viewer'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const REMOVAL_SUBJECTS = ['photo', 'name', 'other'] as const;
export type RemovalSubject = (typeof REMOVAL_SUBJECTS)[number];

export const REMOVAL_STATUSES = ['new', 'done', 'rejected'] as const;
export type RemovalStatus = (typeof REMOVAL_STATUSES)[number];

// Provenienza registrata su ogni riga (brief 10 e 16.7). 'tuttocampo' è riservato:
// nessun codice lo scrive finché non esistono permesso scritto e feed ufficiale.
export const DATA_SOURCES = ['admin', 'csv', 'tuttocampo', 'example', 'public'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

// Da dove arriva una squadra in una casella del tabellone non ancora decisa.
export type SlotSource =
  | { kind: 'group_rank'; groupId: number; rank: number }
  | { kind: 'match_winner'; matchId: number }
  | { kind: 'match_loser'; matchId: number };
