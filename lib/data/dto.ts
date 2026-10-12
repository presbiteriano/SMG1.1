import type {
  CompetitionType,
  DecidedBy,
  EditionStatus,
  EntryStatus,
  MatchEventType,
  MatchStatus,
  PlayerRole,
  Severity,
  StageKind,
} from '@/db/schema/enums';
import type { EditionConfig, Tiebreaker } from '@/lib/config/edition-config';
import type { SiteSettings } from '@/lib/config/site-settings';

// Forma pubblica dei dati: solo ciò che il sito può mostrare. I nomi delle persone arrivano qui
// già nella forma pubblicabile, quindi nessun dato personale grezzo finisce in cache o al browser.
// Le date sono stringhe ISO in UTC: i dati passano dalla cache come JSON.

export type TeamRef = {
  entryId: number;
  teamId: number;
  slug: string;
  name: string;
  code: string;
  kitColor: string | null;
  crestId: number | null;
};

export type EventDTO = {
  id: number;
  type: MatchEventType;
  minute: number | null;
  side: 'home' | 'away';
  playerName: string | null;
};

export type MatchDTO = {
  id: number;
  competitionId: number;
  competitionSlug: string;
  competitionName: string;
  competitionType: CompetitionType;
  stageId: number;
  stageKind: StageKind;
  stageName: string;
  groupId: number | null;
  groupName: string | null;
  round: number | null;
  slot: number | null;
  /** «Girone A · Giornata 1», «Quarto 1», «Finale»... */
  label: string;
  shortLabel: string;
  home: TeamRef | null;
  away: TeamRef | null;
  /** Testo per una casella non ancora decisa: «Vincente girone B». */
  homePlaceholder: string | null;
  awayPlaceholder: string | null;
  kickoffAt: string | null;
  fieldName: string | null;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  homePens: number | null;
  awayPens: number | null;
  decidedBy: DecidedBy | null;
  winner: 'home' | 'away' | null;
  note: string | null;
  version: number;
  updatedAt: string;
  events: EventDTO[];
};

export type StandingsRowDTO = {
  team: TeamRef;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  tied: boolean;
  qualifies: boolean;
};

export type GroupDTO = {
  id: number;
  name: string;
  rows: StandingsRowDTO[];
  provisional: boolean;
  hasResults: boolean;
  notes: { criterion: Exclude<Tiebreaker, 'points'>; teamCodes: string[] }[];
};

export type StageDTO = {
  id: number;
  name: string;
  kind: StageKind;
  groups: GroupDTO[];
};

export type CompetitionDTO = {
  id: number;
  slug: string;
  name: string;
  type: CompetitionType;
  stages: StageDTO[];
};

export type RosterPlayerDTO = {
  number: number | null;
  name: string;
  hidden: boolean;
  role: PlayerRole | null;
};

export type EditionTeamDTO = TeamRef & {
  groupId: number | null;
  groupName: string | null;
  status: EntryStatus;
  /** null se le rose di questa edizione non sono pubblicate. */
  roster: RosterPlayerDTO[] | null;
};

export type ScorerDTO = {
  name: string;
  hidden: boolean;
  teamCode: string;
  teamSlug: string;
  goals: number;
};

export type TeamStatDTO = {
  teamCode: string;
  teamName: string;
  teamSlug: string;
  value: number;
};

export type StatsDTO = {
  matchesPlayed: number;
  goals: number;
  shootouts: number;
  yellow: number;
  red: number;
  topScorers: ScorerDTO[];
  bestAttack: TeamStatDTO[];
  bestDefense: TeamStatDTO[];
  fairPlay: TeamStatDTO[];
  mvps: { name: string; teamCode: string; matchId: number; label: string }[];
};

export type PodiumDTO = {
  winner: TeamRef;
  runnerUp: TeamRef | null;
  semifinalists: TeamRef[];
};

export type VenueDTO = {
  name: string;
  address: string | null;
  mapsUrl: string | null;
};

export type EditionInfo = {
  id: number;
  year: number;
  name: string;
  status: EditionStatus;
  startDate: string | null;
  endDate: string | null;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  rulesUrl: string | null;
  config: EditionConfig;
  venue: VenueDTO | null;
  isExample: boolean;
};

export type EditionBundle = {
  edition: EditionInfo;
  competitions: CompetitionDTO[];
  teams: EditionTeamDTO[];
  matches: MatchDTO[];
  stats: StatsDTO;
  cup: PodiumDTO | null;
  supercupWinner: TeamRef | null;
};

export type EditionSummary = {
  id: number;
  year: number;
  name: string;
  status: EditionStatus;
  startDate: string | null;
  endDate: string | null;
  matchCount: number;
  teamCount: number;
  competitions: { slug: string; name: string; type: CompetitionType }[];
  isExample: boolean;
};

export type AnnouncementDTO = {
  id: number;
  severity: Severity;
  title: string;
  body: string | null;
  link: string | null;
  startsAt: string;
  endsAt: string | null;
  editionYear: number | null;
};

export type SponsorDTO = {
  id: number;
  name: string;
  url: string | null;
  logoId: number | null;
  tier: string;
  visibleFrom: string | null;
  visibleTo: string | null;
  editionYears: number[];
};

export type SiteBundle = {
  settings: SiteSettings;
  editions: EditionSummary[];
  /** Edizione che guida la home. */
  featuredYear: number | null;
  /** Edizione più recente che ha partite: alimenta MatchRail e scorciatoie quando la prossima è ancora vuota. */
  dataYear: number | null;
  announcements: AnnouncementDTO[];
  sponsors: SponsorDTO[];
  hasExampleData: boolean;
};

export type TeamIndexEntry = {
  teamId: number;
  slug: string;
  name: string;
  code: string;
  kitColor: string | null;
  crestId: number | null;
  years: number[];
};

export type PhotoDTO = {
  id: number;
  width: number;
  height: number;
  variants: number[];
  alt: string;
  caption: string | null;
  credit: string | null;
  matchId: number | null;
  year: number | null;
};

export type HonourCell = {
  winner: { name: string; slug: string | null } | null;
  runnerUp: { name: string; slug: string | null } | null;
  topScorer: { name: string; goals: number | null } | null;
};

export type HallRow = {
  year: number;
  editionName: string;
  hasDetails: boolean;
  cup: HonourCell;
  supercup: HonourCell;
};

export type DocumentDTO = {
  title: string;
  body: string;
  fileUrl: string | null;
  revisedAt: string | null;
};

/** Risposta dei dati in cache: quando è stata generata e se arriva dalla modalità degradata. */
export type Snapshot<T> = {
  data: T;
  generatedAt: string;
  degraded: boolean;
};
