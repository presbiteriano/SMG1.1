import { findPublicMatch, matchToIcs } from '@/lib/data/lookup';
import { buildCalendar, calendarResponse } from '@/lib/ics';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await findPublicMatch((await params).id);
  const event = found ? matchToIcs(found.match, found.bundle) : null;
  if (!found || !event) return new Response(null, { status: 404 });
  return calendarResponse(buildCalendar(found.bundle.edition.name, [event]), `smg-partita-${found.match.id}.ics`);
}
