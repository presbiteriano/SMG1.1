import { updateTag } from 'next/cache';

// Etichette di cache (brief 12.2). Dopo un salvataggio dal pannello le pagine toccate
// si rigenerano alla richiesta successiva: il risultato è visibile a tutti subito, non dopo un minuto.

export const tags = {
  site: () => ['site', 'home'],
  edition: (year: number) => [`edition-${year}`, `standings-${year}`, 'matches', 'home', 'site', 'teams', 'hall-of-fame'],
  match: (year: number, matchId: number) => [`edition-${year}`, `standings-${year}`, `match-${matchId}`, 'matches', 'home', 'hall-of-fame'],
  teams: () => ['teams', 'matches', 'site'],
  media: (year: number | null) => ['media', 'site', 'teams', ...(year === null ? [] : [`media-${year}`, `edition-${year}`])],
  hall: () => ['hall-of-fame'],
  documents: () => ['documents'],
};

/** Da usare solo dentro una Server Action. */
export function invalidate(...groups: string[][]): void {
  for (const tag of new Set(groups.flat())) updateTag(tag);
}

/** Tutto: dopo un'importazione o il caricamento dei dati di esempio. */
export function invalidateEverything(years: number[]): void {
  invalidate(tags.site(), tags.teams(), tags.hall(), tags.documents(), ['media', 'numbers'], ...years.map((year) => tags.edition(year)), ...years.map((year) => [`media-${year}`]));
}
