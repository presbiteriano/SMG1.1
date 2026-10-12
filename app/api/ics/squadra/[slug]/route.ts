import type { EditionBundle } from '@/lib/data/dto';
import { matchToIcs } from '@/lib/data/lookup';
import { getEdition, getTeamsIndex } from '@/lib/data/queries';
import { fmt, m } from '@/lib/i18n';
import { buildCalendar, calendarResponse, type IcsEvent } from '@/lib/ics';

// Calendario di una squadra: tutte le sue partite con un orario. L'indirizzo resta lo stesso,
// quindi un'app che lo sottoscrive vede da sola rinvii e nuovi orari.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = (await getTeamsIndex()).data.find((item) => item.slug === slug);
  if (!team) return new Response(null, { status: 404 });

  const bundles = (await Promise.all(team.years.slice(0, 2).map((year) => getEdition(year)))).map((snapshot) => snapshot.data).filter((bundle): bundle is EditionBundle => bundle !== null);
  const events: IcsEvent[] = bundles.flatMap((bundle) =>
    bundle.matches
      .filter((match) => match.home?.slug === slug || match.away?.slug === slug)
      .map((match) => matchToIcs(match, bundle))
      .filter((event): event is IcsEvent => event !== null),
  );
  return calendarResponse(buildCalendar(fmt(m.ics.calendarName, { team: team.name, brand: m.brand.name }), events), `smg-${slug}.ics`);
}
