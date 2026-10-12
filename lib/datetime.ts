// Orari: UTC nel database, Europe/Rome a schermo (brief 7.2 e 16.3).
// Tutta la formattazione passa da formatRome: nessun altro punto del codice formatta date.

export const TIME_ZONE = 'Europe/Rome';
const LOCALE = 'it-IT';

const PRESETS = {
  /** 20:00 */
  time: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  /** lun 7 giu */
  dayShort: { weekday: 'short', day: 'numeric', month: 'short' },
  /** lunedì 7 giugno */
  dayLong: { weekday: 'long', day: 'numeric', month: 'long' },
  /** lunedì 7 giugno 2027 */
  dayFull: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  /** 7 giugno 2027 */
  date: { day: 'numeric', month: 'long', year: 'numeric' },
  /** 7 giu 2027 */
  dateShort: { day: 'numeric', month: 'short', year: 'numeric' },
  /** 7 giu, 20:00 */
  dateTime: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  /** lun */
  weekday: { weekday: 'short' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DatePreset = keyof typeof PRESETS;

const formatters = new Map<DatePreset, Intl.DateTimeFormat>();

function formatter(preset: DatePreset): Intl.DateTimeFormat {
  let found = formatters.get(preset);
  if (!found) {
    found = new Intl.DateTimeFormat(LOCALE, { ...PRESETS[preset], timeZone: TIME_ZONE });
    formatters.set(preset, found);
  }
  return found;
}

function toDate(input: string | Date): Date {
  return typeof input === 'string' ? new Date(input) : input;
}

/** L'unica funzione che trasforma un istante in testo per l'utente, sempre in ora di Roma. */
export function formatRome(input: string | Date, preset: DatePreset): string {
  return formatter(preset).format(toDate(input));
}

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function romeParts(at: Date): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number> {
  const out = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
  for (const part of partsFormatter.formatToParts(at)) {
    if (part.type in out) out[part.type as keyof typeof out] = Number(part.value);
  }
  return out;
}

/** Giorno di calendario a Roma, nel formato AAAA-MM-GG: serve per raggruppare le partite per serata. */
export function romeDateKey(input: string | Date): string {
  const p = romeParts(toDate(input));
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Ora a Roma nel formato HH:MM, per i campi dei moduli. */
export function romeTimeKey(input: string | Date): string {
  const p = romeParts(toDate(input));
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

function offsetMinutes(at: Date): number {
  const p = romeParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Da data e ora di Roma all'istante UTC da salvare: 2027-06-07 alle 20:00 diventa 18:00 UTC (T12). */
export function romeLocalToUtc(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const first = naive - offsetMinutes(new Date(naive)) * 60_000;
  // Secondo passaggio: vicino al cambio dell'ora il primo scarto può essere quello sbagliato.
  return new Date(naive - offsetMinutes(new Date(first)) * 60_000);
}

/** Sposta un giorno di calendario di n giorni (anche negativi). */
export function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Giorni di calendario tra due date (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Mezzogiorno UTC del giorno indicato: un istante sicuro per formattare una data senza orario. */
export function dateKeyToInstant(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`);
}
