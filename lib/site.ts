import type { EditionBundle, EditionInfo, EditionSummary, MatchDTO, SiteBundle, SponsorDTO } from '@/lib/data/dto';
import { dateKeyToInstant, formatRome, romeDateKey } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';

// Regole di presentazione condivise dalle pagine pubbliche.

export type RegistrationState = 'open' | 'not_yet' | 'closed';

/** Le iscrizioni sono aperte se lo dice lo stato dell'edizione e siamo dentro la finestra di date. */
export function registrationState(edition: Pick<EditionInfo, 'status' | 'registrationOpenAt' | 'registrationCloseAt'>, now: Date): RegistrationState {
  if (edition.status !== 'registrations_open') return 'closed';
  if (edition.registrationOpenAt && Date.parse(edition.registrationOpenAt) > now.getTime()) return 'not_yet';
  if (edition.registrationCloseAt && Date.parse(edition.registrationCloseAt) <= now.getTime()) return 'closed';
  return 'open';
}

/** Edizione non ancora iniziata: ha una pagina di presentazione all'indirizzo /[anno]. */
export function isUpcoming(status: EditionSummary['status']): boolean {
  return status === 'announced' || status === 'registrations_open' || status === 'scheduled';
}

export function editionHref(edition: Pick<EditionSummary, 'year' | 'status'>): string {
  return isUpcoming(edition.status) ? `/${edition.year}` : `/edizioni/${edition.year}`;
}

/** «Dal 7 giugno al 18 giugno 2027» oppure «Date in arrivo». */
export function editionDates(edition: Pick<EditionInfo, 'startDate' | 'endDate'>): string {
  if (!edition.startDate) return m.hub.datesSoon;
  const from = formatRome(dateKeyToInstant(edition.startDate), 'dayLong');
  if (!edition.endDate || edition.endDate === edition.startDate) return formatRome(dateKeyToInstant(edition.startDate), 'dayFull');
  return fmt(m.hub.fromTo, { from, to: formatRome(dateKeyToInstant(edition.endDate), 'date') });
}

export function matchesOn(matches: MatchDTO[], dateKey: string): MatchDTO[] {
  return matches.filter((match) => match.kickoffAt !== null && romeDateKey(match.kickoffAt) === dateKey);
}

/** Sponsor visibili oggi, per l'edizione indicata (o per tutte se l'edizione non è indicata). */
export function visibleSponsors(site: SiteBundle, year: number | null, now: Date): SponsorDTO[] {
  const today = romeDateKey(now);
  return site.sponsors.filter((sponsor) => {
    if (sponsor.visibleFrom && sponsor.visibleFrom > today) return false;
    if (sponsor.visibleTo && sponsor.visibleTo < today) return false;
    return year === null || sponsor.editionYears.length === 0 || sponsor.editionYears.includes(year);
  });
}

/** Cambia a ogni modifica dei dati di gara: il browser la confronta per sapere se ricaricare. */
export function editionStamp(bundle: EditionBundle | null): string {
  if (!bundle) return 'none';
  const versions = bundle.matches.reduce((sum, match) => sum + match.version, 0);
  return `${bundle.edition.status}:${bundle.matches.length}:${versions}`;
}

/** Ogni quanto il browser controlla: 30 s con una partita in corso, 60 s nelle serate di gioco, mai altrimenti. */
export function pollInterval(bundle: EditionBundle | null, now: Date): number | null {
  if (!bundle || bundle.edition.status !== 'live') return null;
  if (bundle.matches.some((match) => match.status === 'live')) return 30_000;
  return matchesOn(bundle.matches, romeDateKey(now)).length > 0 ? 60_000 : null;
}

export function parseYear(value: string | undefined): number | null {
  return value && /^\d{4}$/.test(value) ? Number(value) : null;
}
