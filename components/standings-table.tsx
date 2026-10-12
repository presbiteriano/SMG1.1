import Link from 'next/link';
import type { EditionConfig } from '@/lib/config/edition-config';
import type { GroupDTO } from '@/lib/data/dto';
import { fmt, m } from '@/lib/i18n';
import { cx, signed } from '@/lib/ui';
import { TeamCrest } from './team-crest';
import { Pill } from './ui';

// StandingsTable: una tabella per girone, calcolata dai risultati (mai inserita a mano).
// Le posizioni che valgono il passaggio del turno hanno barra celeste e sigla «Q»: non solo colore.

const COLUMNS = [
  ['played', m.standings.played, m.standings.playedLong],
  ['won', m.standings.won, m.standings.wonLong],
  ['drawn', m.standings.drawn, m.standings.drawnLong],
  ['lost', m.standings.lost, m.standings.lostLong],
  ['goalsFor', m.standings.gf, m.standings.gfLong],
  ['goalsAgainst', m.standings.ga, m.standings.gaLong],
] as const;

function Th({ short, long, className }: { short: string; long: string; className?: string }) {
  return (
    <th scope="col" className={cx('kicker px-1 py-2 text-center text-xs text-muted', className)}>
      <abbr title={long} className="no-underline">
        {short}
      </abbr>
    </th>
  );
}

export function StandingsTable({ group, compact = false, limit }: { group: GroupDTO; compact?: boolean; limit?: number }) {
  const rows = limit ? group.rows.slice(0, limit) : group.rows;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-inverse px-3 py-2 text-on-inverse">
        <h3 className="text-xl">{fmt(m.standings.groupTitle, { group: group.name })}</h3>
        {group.hasResults ? (
          <Pill tone={group.provisional ? 'sky' : 'soft'}>{group.provisional ? m.standings.provisional : m.standings.final}</Pill>
        ) : null}
      </div>
      <table className="w-full border-collapse text-sm tabular-nums">
        <caption className="sr-only">{fmt(m.standings.caption, { group: group.name })}</caption>
        <thead>
          <tr className="border-b border-line">
            <Th short={m.standings.pos} long={m.standings.posLong} className="w-9 pl-3" />
            <th scope="col" className="kicker px-1 py-2 text-left text-xs text-muted">
              {m.standings.team}
            </th>
            <Th short={m.standings.pts} long={m.standings.ptsLong} className="text-text" />
            {compact ? <Th short={m.standings.played} long={m.standings.playedLong} /> : COLUMNS.map(([key, short, long]) => <Th key={key} short={short} long={long} />)}
            <Th short={m.standings.gd} long={m.standings.gdLong} className="pr-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.team.entryId} data-team={row.team.slug} className={cx('border-b border-line last:border-b-0', row.qualifies && 'bg-surface-2')}>
              <td className={cx('py-2 pl-3 text-center', row.qualifies && 'shadow-[inset_4px_0_0_var(--accent)]')}>
                <span className="display text-lg">
                  {row.position}
                  {row.tied ? <span aria-hidden>=</span> : null}
                </span>
              </td>
              <th scope="row" className="max-w-0 px-1 py-2 text-left font-normal">
                <Link href={`/squadre/${row.team.slug}`} className="flex min-h-9 items-center gap-2">
                  <TeamCrest team={row.team} size={24} />
                  <span className={cx('display text-lg', !compact && 'sm:hidden')}>{row.team.code}</span>
                  {compact ? null : <span className="hidden truncate font-semibold sm:inline">{row.team.name}</span>}
                  <span className="sr-only sm:hidden">{row.team.name}</span>
                  {row.qualifies ? (
                    <span className="kicker rounded-sm bg-accent px-1 py-0.5 text-[0.625rem] text-on-accent" title={m.standings.qualified}>
                      Q<span className="sr-only"> {m.standings.qualified}</span>
                    </span>
                  ) : null}
                </Link>
              </th>
              <td className="px-1 py-2 text-center">
                <span className="display text-xl">{row.points}</span>
              </td>
              {compact ? (
                <td className="px-1 py-2 text-center">{row.played}</td>
              ) : (
                COLUMNS.map(([key]) => (
                  <td key={key} className="px-1 py-2 text-center">
                    {row[key]}
                  </td>
                ))
              )}
              <td className="py-2 pr-3 pl-1 text-center font-semibold">{signed(row.goalDiff)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Legenda sotto le tabelle: spiega punti, criteri applicati e spareggi decisi (brief 7.3). */
export function StandingsLegend({ groups, config }: { groups: GroupDTO[]; config: EditionConfig }) {
  const criteria = config.tiebreakers
    .filter((criterion) => criterion !== 'points')
    .map((criterion) => fmt(m.standings.criteria[criterion], { yellow: config.fair_play.yellow, red: config.fair_play.red }))
    .join(', ');
  const provisional = groups.some((group) => group.provisional && group.hasResults);
  const tied = groups.some((group) => group.rows.some((row) => row.tied && row.played > 0));
  return (
    <div className="space-y-1.5 text-sm text-muted">
      <p>
        <span className="mr-1.5 inline-block h-3 w-1 rounded-sm bg-accent align-middle" aria-hidden />
        {fmt(m.standings.qualifiedLegend, { n: config.qualify_per_group })}
      </p>
      <p>{fmt(m.standings.pointsLegend, config.points)}</p>
      <p>{fmt(m.standings.criteriaLegend, { criteria })}</p>
      {groups.flatMap((group) =>
        group.notes.map((note) => (
          <p key={`${group.id}-${note.criterion}-${note.teamCodes.join('')}`} className="text-text">
            <strong>{fmt(m.standings.groupTitle, { group: group.name })}.</strong>{' '}
            {fmt(m.standings.tiebreakNote, { teams: note.teamCodes.join(', '), criterion: m.standings.criteriaShort[note.criterion] })}
          </p>
        )),
      )}
      {tied ? <p className="text-text">{m.standings.tiedLegend}</p> : null}
      {provisional ? <p>{m.standings.provisionalNote}</p> : null}
    </div>
  );
}
