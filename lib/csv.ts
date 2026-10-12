import type { MatchStatus, StageKind } from '@/db/schema/enums';
import { foldText } from './slug';

// CSV: lettura per l'importazione dei dati storici e scrittura per le esportazioni (brief 9 e 10).

/** Legge un CSV con virgola o punto e virgola, virgolette doppie comprese. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((cells) => cells.map((value) => value.trim())).filter((cells) => cells.some((value) => value !== ''));
}

/** Scrive un CSV che si apre bene in Excel e Fogli Google. Le celle che iniziano con = + - @ vengono neutralizzate. */
export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (value: string | number | boolean | null | undefined) => {
    let out = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(out)) out = `'${out}`;
    return /[";\n\r]/.test(out) ? `"${out.replace(/"/g, '""')}"` : out;
  };
  return `﻿${[header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`;
}

export type CsvMatchError = 'team' | 'date' | 'time' | 'score' | 'status' | 'stage';

export type CsvMatchRow = {
  line: number;
  competition: string;
  stage: StageKind;
  group: string | null;
  round: number | null;
  date: string | null;
  time: string | null;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  homePens: number | null;
  awayPens: number | null;
  status: MatchStatus;
  errors: CsvMatchError[];
};

const COLUMNS: Record<string, keyof typeof ALIASES> = {};
const ALIASES = {
  competition: ['competizione'],
  stage: ['fase'],
  group: ['girone'],
  round: ['giornata'],
  date: ['data'],
  time: ['ora', 'orario'],
  home: ['casa', 'squadracasa'],
  away: ['ospite', 'ospiti', 'squadraospite'],
  homeScore: ['golcasa'],
  awayScore: ['golospite', 'golospiti'],
  homePens: ['rigoricasa'],
  awayPens: ['rigoriospite', 'rigoriospiti'],
  status: ['stato'],
} as const;
for (const [key, names] of Object.entries(ALIASES)) for (const name of names) COLUMNS[name] = key as keyof typeof ALIASES;

const key = (value: string) => foldText(value).replace(/[^a-z0-9]/g, '');

const STAGES: Record<string, StageKind> = {
  '': 'group',
  gironi: 'group',
  girone: 'group',
  ottavi: 'round_of_16',
  ottavidifinale: 'round_of_16',
  quarti: 'quarter',
  quartidifinale: 'quarter',
  semifinale: 'semi',
  semifinali: 'semi',
  finale: 'final',
  finale3posto: 'third_place',
  finaleterzoposto: 'third_place',
  supercoppa: 'single',
  partitaunica: 'single',
};

const STATUSES: Record<string, MatchStatus> = {
  finita: 'finished',
  giocata: 'finished',
  dagiocare: 'scheduled',
  incorso: 'live',
  rinviata: 'postponed',
  annullata: 'cancelled',
  atavolino: 'forfeited',
  tavolino: 'forfeited',
};

function parseDate(value: string): string | null | undefined {
  if (value === '') return null;
  const italian = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  const key = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : italian ? `${italian[3]}-${italian[2].padStart(2, '0')}-${italian[1].padStart(2, '0')}` : null;
  if (!key) return undefined;
  // Il 31 febbraio o il mese 13 non sono date: si controlla che il giorno esista davvero.
  const parsed = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === key ? key : undefined;
}

function parseScore(value: string): number | null | undefined {
  if (value === '') return null;
  return /^\d{1,2}$/.test(value) ? Number(value) : undefined;
}

/** Trasforma il CSV in righe di partita, segnando riga per riga che cosa non torna. */
export function parseMatchesCsv(input: string): { rows: CsvMatchRow[]; headerOk: boolean } {
  const [header, ...lines] = parseCsv(input);
  if (!header) return { rows: [], headerOk: false };
  const index = new Map<keyof typeof ALIASES, number>();
  header.forEach((name, position) => {
    const column = COLUMNS[key(name)];
    if (column && !index.has(column)) index.set(column, position);
  });
  if (!index.has('home') || !index.has('away')) return { rows: [], headerOk: false };
  const read = (cells: string[], column: keyof typeof ALIASES) => cells[index.get(column) ?? -1] ?? '';

  const rows = lines.map((cells, position): CsvMatchRow => {
    const errors: CsvMatchError[] = [];
    const home = read(cells, 'home');
    const away = read(cells, 'away');
    if (home === '' || away === '' || key(home) === key(away)) errors.push('team');

    const date = parseDate(read(cells, 'date'));
    if (date === undefined) errors.push('date');
    const rawTime = read(cells, 'time').replace('.', ':');
    const time = rawTime === '' ? null : /^([01]?\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime.padStart(5, '0') : undefined;
    if (time === undefined) errors.push('time');

    const scores = [read(cells, 'homeScore'), read(cells, 'awayScore'), read(cells, 'homePens'), read(cells, 'awayPens')].map(parseScore);
    if (scores.some((score) => score === undefined) || (scores[0] === null) !== (scores[1] === null)) errors.push('score');

    const stage = STAGES[key(read(cells, 'stage'))];
    if (!stage) errors.push('stage');

    const rawStatus = key(read(cells, 'status'));
    const status = rawStatus === '' ? (scores[0] !== null && scores[0] !== undefined ? 'finished' : 'scheduled') : STATUSES[rawStatus];
    if (!status) errors.push('status');

    const round = read(cells, 'round');
    return {
      line: position + 2,
      competition: read(cells, 'competition'),
      stage: stage ?? 'group',
      group: read(cells, 'group').replace(/^girone\s+/i, '').toUpperCase() || null,
      round: /^\d{1,2}$/.test(round) ? Number(round) : null,
      date: date ?? null,
      time: time ?? null,
      home,
      away,
      homeScore: scores[0] ?? null,
      awayScore: scores[1] ?? null,
      homePens: scores[2] ?? null,
      awayPens: scores[3] ?? null,
      status: status ?? 'scheduled',
      errors,
    };
  });
  return { rows, headerOk: true };
}
