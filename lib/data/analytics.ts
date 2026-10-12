import { and, gte, lt, sql } from 'drizzle-orm';
import { analyticsDaily } from '@/db/schema';
import { romeDateKey, shiftDateKey } from '@/lib/datetime';
import type { Db } from './db';

// Statistiche di visita senza cookie (brief 8 e 13.4): un contatore per giorno, evento, chiave e
// provenienza. Nessun indirizzo IP, nessun identificativo, nessun dato individuale.

export const TRACK_EVENTS = ['pageview', 'entry', 'sponsor_click', 'share', 'registration'] as const;
export type TrackEvent = (typeof TRACK_EVENTS)[number];

export const ORIGINS = ['instagram', 'whatsapp', 'search', 'other', 'direct'] as const;
export type Origin = (typeof ORIGINS)[number];

/** Da quale canale arriva una visita: parametro del link in bio oppure sito di provenienza. */
export function classifyOrigin(referrer: string | null, tagged: string | null): Origin {
  const tag = (tagged ?? '').toLowerCase();
  if (tag === 'ig' || tag.includes('instagram')) return 'instagram';
  if (tag === 'wa' || tag.includes('whatsapp')) return 'whatsapp';
  let host = '';
  try {
    host = referrer ? new URL(referrer).hostname.toLowerCase() : '';
  } catch {
    host = '';
  }
  if (!host) return 'direct';
  if (host.endsWith('instagram.com')) return 'instagram';
  if (host.endsWith('whatsapp.com') || host === 'wa.me') return 'whatsapp';
  if (/(^|\.)(google|bing|duckduckgo|ecosia|qwant)\./.test(host)) return 'search';
  return 'other';
}

/** Riduce un indirizzo a una chiave senza identificativi: /squadre/faro-rovers diventa /squadre/[squadra]. */
export function normalizePath(pathname: string): string {
  const clean = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  return clean
    .replace(/^\/edizioni\/(\d{4})\/partite\/\d+$/, '/edizioni/$1/partite/[partita]')
    .replace(/^\/squadre\/[^/]+$/, '/squadre/[squadra]')
    .slice(0, 120);
}

export async function recordEvent(db: Db, input: { event: TrackEvent; key?: string; origin?: Origin | ''; at?: Date }): Promise<void> {
  const day = romeDateKey(input.at ?? new Date());
  await db
    .insert(analyticsDaily)
    .values({ day, event: input.event, key: input.key ?? '', origin: input.origin ?? '', count: 1 })
    .onConflictDoUpdate({
      target: [analyticsDaily.day, analyticsDaily.event, analyticsDaily.key, analyticsDaily.origin],
      set: { count: sql`${analyticsDaily.count} + 1` },
    });
}

export type AnalyticsSummary = {
  days: number;
  pageviews: number;
  entries: number;
  sponsorClicks: number;
  shares: number;
  registrations: number;
  byOrigin: Record<Origin, number>;
  topPages: { key: string; count: number }[];
  sponsorClicksById: { key: string; count: number }[];
};

export async function loadAnalytics(db: Db, days: number, now: Date = new Date()): Promise<AnalyticsSummary> {
  const today = romeDateKey(now);
  const from = shiftDateKey(today, -(days - 1));
  const rows = await db
    .select()
    .from(analyticsDaily)
    .where(and(gte(analyticsDaily.day, from), lt(analyticsDaily.day, shiftDateKey(today, 1))));

  const total = (event: TrackEvent) => rows.filter((row) => row.event === event).reduce((sum, row) => sum + row.count, 0);
  const grouped = (event: TrackEvent) => {
    const map = new Map<string, number>();
    for (const row of rows) if (row.event === event) map.set(row.key, (map.get(row.key) ?? 0) + row.count);
    return [...map.entries()].map(([key, value]) => ({ key, count: value })).sort((a, b) => b.count - a.count);
  };

  const byOrigin = Object.fromEntries(ORIGINS.map((origin) => [origin, 0])) as Record<Origin, number>;
  for (const row of rows) {
    if (row.event === 'entry' && (ORIGINS as readonly string[]).includes(row.origin)) byOrigin[row.origin as Origin] += row.count;
  }

  return {
    days,
    pageviews: total('pageview'),
    entries: total('entry'),
    sponsorClicks: total('sponsor_click'),
    shares: total('share'),
    registrations: total('registration'),
    byOrigin,
    topPages: grouped('pageview').slice(0, 12),
    sponsorClicksById: grouped('sponsor_click'),
  };
}

export type PublicNumbers = Pick<AnalyticsSummary, 'pageviews' | 'entries' | 'sponsorClicks' | 'shares'> & { instagram: number; whatsapp: number };

/** Numeri aggregati mostrabili nella pagina Sponsor. */
export async function loadPublicNumbers(db: Db, days: number): Promise<PublicNumbers> {
  const summary = await loadAnalytics(db, days);
  return {
    pageviews: summary.pageviews,
    entries: summary.entries,
    sponsorClicks: summary.sponsorClicks,
    shares: summary.shares,
    instagram: summary.byOrigin.instagram,
    whatsapp: summary.byOrigin.whatsapp,
  };
}
