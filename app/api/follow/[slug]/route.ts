import { byKickoff } from '@/lib/bracket/view';
import { getEdition, getTeamsIndex } from '@/lib/data/queries';
import { formatRome } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';

// Dati per il chip «Segui la tua squadra»: posizione e prossima partita (brief 8).
// La scelta della squadra vive nel browser: qui arriva solo la chiave pubblica della squadra.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = (await getTeamsIndex()).data.find((item) => item.slug === slug);
  if (!team) return Response.json(null, { status: 404 });

  const year = team.years[0];
  const bundle = year ? (await getEdition(year)).data : null;
  let position: string | null = null;
  let next: string | null = null;
  let nextHref: string | null = null;

  if (bundle) {
    for (const group of bundle.competitions.flatMap((competition) => competition.stages.flatMap((stage) => stage.groups))) {
      const row = group.rows.find((item) => item.team.slug === slug);
      if (row && row.played > 0) position = fmt(m.follow.position, { pos: row.position, group: fmt(m.match.group, { group: group.name }) });
    }
    const upcoming = bundle.matches.filter((match) => (match.home?.slug === slug || match.away?.slug === slug) && (match.status === 'scheduled' || match.status === 'live')).sort(byKickoff)[0];
    if (upcoming?.kickoffAt) {
      next = upcoming.status === 'live' ? m.status.liveNow : `${formatRome(upcoming.kickoffAt, 'weekday')} ${formatRome(upcoming.kickoffAt, 'time')}`;
      nextHref = `/edizioni/${bundle.edition.year}/partite/${upcoming.id}`;
    }
  }

  return Response.json({ slug: team.slug, name: team.name, code: team.code, position, next, nextHref }, { headers: { 'Cache-Control': 'no-store' } });
}
