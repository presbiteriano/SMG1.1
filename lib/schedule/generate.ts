import type { StageKind } from '@/db/schema/enums';

// Generatore di calendario (brief 9, proposta): gironi all'italiana e tabellone a eliminazione.
// Funzioni pure: decidono che cosa creare; a scrivere nel database pensa l'azione del pannello.

export type Pairing<T> = { round: number; home: T; away: T };

/** Girone all'italiana di sola andata con il metodo del cerchio: ogni squadra incontra tutte le altre una volta. */
export function roundRobin<T>(teams: T[]): Pairing<T>[] {
  const list: (T | null)[] = [...teams];
  if (list.length % 2 === 1) list.push(null); // con squadre dispari, a turno una riposa
  const rounds = list.length - 1;
  const half = list.length / 2;
  const out: Pairing<T>[] = [];
  for (let round = 0; round < rounds; round += 1) {
    for (let index = 0; index < half; index += 1) {
      const a = list[index];
      const b = list[list.length - 1 - index];
      if (a === null || b === null) continue;
      // Si alterna chi gioca in casa, così nessuno è sempre primo in elenco.
      out.push(round % 2 === 0 ? { round: round + 1, home: a, away: b } : { round: round + 1, home: b, away: a });
    }
    list.splice(1, 0, list.pop() as T | null);
  }
  return out;
}

export type KnockoutSource = { kind: 'group'; group: number; rank: number } | { kind: 'winner'; stage: StageKind; slot: number };
export type KnockoutMatch = { stage: StageKind; slot: number; home: KnockoutSource; away: KnockoutSource };

const STAGE_BY_SIZE: Record<number, StageKind> = { 2: 'final', 4: 'semi', 8: 'quarter', 16: 'round_of_16' };

/**
 * Tabellone a partire dai gironi. Con due qualificate per girone si incrociano i gironi a coppie
 * (A1-B2, B1-A2, C1-D2, D1-C2) e due squadre dello stesso girone si possono ritrovare solo in finale.
 * Restituisce null se la combinazione non è gestita: in quel caso il tabellone si crea a mano.
 */
export function knockoutPlan(groups: number, qualifyPerGroup: number): KnockoutMatch[] | null {
  const teams = groups * qualifyPerGroup;
  if (!STAGE_BY_SIZE[teams]) return null;

  type First = { home: KnockoutSource; away: KnockoutSource };
  if (qualifyPerGroup === 2 && groups % 2 === 0) {
    // Le partite si numerano alternando le due metà del tabellone: A1-B2 è la 1, B1-A2 la 2, C1-D2 la 3...
    const first: First[] = [];
    for (let index = 0; index < groups; index += 2) {
      first.push({ home: { kind: 'group', group: index, rank: 1 }, away: { kind: 'group', group: index + 1, rank: 2 } });
      first.push({ home: { kind: 'group', group: index + 1, rank: 1 }, away: { kind: 'group', group: index, rank: 2 } });
    }
    return buildRounds(first, true);
  }
  if (groups === 1 || qualifyPerGroup === 1) {
    // Teste di serie classiche: la prima contro l'ultima, e così via.
    const seeds: KnockoutSource[] = [];
    for (let rank = 1; rank <= qualifyPerGroup; rank += 1) for (let group = 0; group < groups; group += 1) seeds.push({ kind: 'group', group, rank });
    const first: First[] = [];
    for (let index = 0; index < teams / 2; index += 1) first.push({ home: seeds[index], away: seeds[teams - 1 - index] });
    return buildRounds(first, false);
  }
  return null;
}

/**
 * Dal primo turno alla finale. Con `crossed` le partite dispari e pari appartengono a metà diverse
 * del tabellone: il turno dopo accoppia le dispari tra loro e le pari tra loro (semifinale 1 = quarti 1 e 3).
 */
function buildRounds(first: { home: KnockoutSource; away: KnockoutSource }[], crossed: boolean): KnockoutMatch[] {
  const out: KnockoutMatch[] = [];
  let size = first.length * 2;
  let stage = STAGE_BY_SIZE[size];
  first.forEach((match, index) => out.push({ stage, slot: index + 1, ...match }));

  let previous = first.map((_, index) => index + 1);
  let previousStage = stage;
  let split = crossed;
  while (previous.length > 1) {
    size /= 2;
    stage = STAGE_BY_SIZE[size];
    const order = split ? [...previous.filter((slot) => slot % 2 === 1), ...previous.filter((slot) => slot % 2 === 0)] : previous;
    const next: number[] = [];
    for (let index = 0; index < order.length; index += 2) {
      const slot = index / 2 + 1;
      out.push({ stage, slot, home: { kind: 'winner', stage: previousStage, slot: order[index] }, away: { kind: 'winner', stage: previousStage, slot: order[index + 1] } });
      next.push(slot);
    }
    previous = next;
    previousStage = stage;
    split = false;
  }
  return out;
}

/** Distribuisce le partite sugli orari disponibili, in ordine: una serata dopo l'altra, uno slot dopo l'altro. */
export function assignSlots<T>(items: T[], evenings: string[], slotTimes: string[]): (T & { date: string | null; time: string | null })[] {
  return items.map((item, index) => {
    const evening = evenings[Math.floor(index / slotTimes.length)];
    return { ...item, date: evening ?? null, time: evening ? slotTimes[index % slotTimes.length] : null };
  });
}

/** Mette le squadre nei gironi a serpentina, in ordine di testa di serie: 1-2-3-4, 4-3-2-1... */
export function snakeGroups<T>(teams: T[], groups: number): T[][] {
  const out: T[][] = Array.from({ length: groups }, () => []);
  teams.forEach((team, index) => {
    const row = Math.floor(index / groups);
    const column = index % groups;
    out[row % 2 === 0 ? column : groups - 1 - column].push(team);
  });
  return out;
}
