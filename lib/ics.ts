// File .ics per «Aggiungi al calendario» (brief 8): uno per partita e uno per squadra.
// L'indirizzo per squadra funziona anche come feed: l'app del calendario lo rilegge e si aggiorna da sola.

export type IcsEvent = {
  uid: string;
  start: Date;
  durationMinutes: number;
  summary: string;
  description: string;
  location: string | null;
  url: string;
  sequence: number;
  cancelled: boolean;
};

const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Le righe lunghe vanno spezzate a 75 caratteri, con uno spazio a capo. */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  parts.push(rest);
  return parts.join('\r\n');
}

export function buildCalendar(name: string, events: IcsEvent[], now: Date = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SMG Summer Cup//Calendario//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(name)}`, 'X-WR-TIMEZONE:Europe/Rome'];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(event.start)}`,
      `DTEND:${stamp(new Date(event.start.getTime() + event.durationMinutes * 60_000))}`,
      `SEQUENCE:${event.sequence}`,
      `STATUS:${event.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
      `SUMMARY:${escapeText(event.summary)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
      ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
      `URL:${event.url}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

export function calendarResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
