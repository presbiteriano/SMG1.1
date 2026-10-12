import { eq } from 'drizzle-orm';
import { editions, matches } from '@/db/schema';
import { siteUrl } from '@/lib/env';
import { fmt, m } from '@/lib/i18n';
import type { IcsEvent } from '@/lib/ics';
import { getDb } from './db';
import type { EditionBundle, MatchDTO } from './dto';
import { getEdition } from './queries';

/** Una partita a partire dal solo identificativo: serve a .ics e immagini condivise. Le bozze restano invisibili. */
export async function findPublicMatch(idParam: string): Promise<{ match: MatchDTO; bundle: EditionBundle } | null> {
  if (!/^\d{1,9}$/.test(idParam)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ year: editions.year })
    .from(matches)
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .where(eq(matches.id, Number(idParam)))
    .limit(1);
  if (!row) return null;
  const bundle = (await getEdition(row.year)).data;
  const match = bundle?.matches.find((item) => item.id === Number(idParam));
  return bundle && match ? { match, bundle } : null;
}

export function matchToIcs(match: MatchDTO, bundle: EditionBundle): IcsEvent | null {
  if (!match.kickoffAt) return null;
  const home = match.home?.name ?? match.homePlaceholder ?? m.match.toBeDecided;
  const away = match.away?.name ?? match.awayPlaceholder ?? m.match.toBeDecided;
  const venue = bundle.edition.venue;
  return {
    uid: `partita-${match.id}@smg-summer-cup`,
    start: new Date(match.kickoffAt),
    durationMinutes: bundle.edition.config.schedule.match_minutes,
    summary: fmt(m.ics.summary, { home, away }),
    description: fmt(m.ics.description, { label: match.label, brand: bundle.edition.name }),
    location: venue ? [match.fieldName, venue.name, venue.address].filter(Boolean).join(', ') : match.fieldName,
    url: `${siteUrl()}/edizioni/${bundle.edition.year}/partite/${match.id}`,
    sequence: match.version,
    cancelled: match.status === 'cancelled',
  };
}
