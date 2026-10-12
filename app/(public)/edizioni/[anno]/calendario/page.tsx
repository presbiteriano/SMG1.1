import { ChevronDown } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarFilters, FollowedFilter, type FilterField } from '@/components/calendar-filters';
import { PrintButton } from '@/components/client-actions';
import { hasScore, MatchCard } from '@/components/match-card';
import { DataFreshness } from '@/components/sections';
import { EmptyState, PageHeader } from '@/components/ui';
import { MATCH_STATUSES, type MatchStatus } from '@/db/schema/enums';
import { byKickoff } from '@/lib/bracket/view';
import type { MatchDTO } from '@/lib/data/dto';
import { param, requireEdition, type SearchParams } from '@/lib/data/public';
import { dateKeyToInstant, formatRome, romeDateKey, shiftDateKey } from '@/lib/datetime';
import { countLabel, fmt, m } from '@/lib/i18n';
import { cx } from '@/lib/ui';

export const metadata: Metadata = { title: m.calendar.title, description: m.calendar.question };

const ALL_DAYS = 'tutte';

/**
 * Serata da aprire quando non è indicata (brief 7.2): oggi se si gioca; durante il torneo la prossima
 * serata da giocare; altrimenti l'ultima giocata o la prima in programma.
 */
function defaultDay(matches: MatchDTO[], today: string): string {
  const days = [...new Set(matches.flatMap((match) => (match.kickoffAt ? [romeDateKey(match.kickoffAt)] : [])))].sort();
  if (days.length === 0 || days.includes(today)) return days.length === 0 ? ALL_DAYS : today;
  const upcoming = days.find((day) => day > today && matches.some((match) => match.kickoffAt && romeDateKey(match.kickoffAt) === day && match.status === 'scheduled'));
  const played = [...days].reverse().find((day) => matches.some((match) => match.kickoffAt && romeDateKey(match.kickoffAt) === day && (match.status === 'finished' || match.status === 'forfeited')));
  return upcoming ?? played ?? days[0];
}

function dayLabel(day: string, today: string): string {
  if (day === today) return m.calendar.today;
  if (day === shiftDateKey(today, 1)) return m.calendar.tomorrow;
  if (day === shiftDateKey(today, -1)) return m.calendar.yesterday;
  return formatRome(dateKeyToInstant(day), 'dayShort');
}

// Calendario e risultati (brief 7.2). Risponde a: chi gioca, quando, e com'è finita.
export default async function CalendarPage({ params, searchParams }: { params: Promise<{ anno: string }>; searchParams: SearchParams }) {
  const snapshot = await requireEdition((await params).anno);
  const bundle = snapshot.data;
  const { edition } = bundle;
  const query = await searchParams;
  const action = `/edizioni/${edition.year}/calendario`;
  const today = romeDateKey(new Date());

  const filters = {
    competizione: param(query, 'competizione'),
    fase: param(query, 'fase'),
    girone: param(query, 'girone'),
    squadra: param(query, 'squadra'),
    stato: param(query, 'stato'),
  };
  const anyFilter = Object.values(filters).some(Boolean);

  const filtered = bundle.matches
    .filter((match) => !filters.competizione || match.competitionSlug === filters.competizione)
    .filter((match) => !filters.fase || String(match.stageId) === filters.fase)
    .filter((match) => !filters.girone || match.groupName === filters.girone)
    .filter((match) => !filters.squadra || match.home?.slug === filters.squadra || match.away?.slug === filters.squadra)
    .filter((match) => !filters.stato || match.status === filters.stato)
    .sort(byKickoff);

  const allDays = [...new Set(bundle.matches.flatMap((match) => (match.kickoffAt ? [romeDateKey(match.kickoffAt)] : [])))].sort();
  // Con un filtro attivo si vede tutto il percorso (per esempio tutte le partite di una squadra).
  const requestedDay = param(query, 'giorno');
  const day = requestedDay && (requestedDay === ALL_DAYS || allDays.includes(requestedDay)) ? requestedDay : anyFilter ? ALL_DAYS : defaultDay(bundle.matches, today);
  const visible = day === ALL_DAYS ? filtered : filtered.filter((match) => match.kickoffAt !== null && romeDateKey(match.kickoffAt) === day);

  const byDay = new Map<string, MatchDTO[]>();
  for (const match of visible) {
    const key = match.kickoffAt ? romeDateKey(match.kickoffAt) : '';
    byDay.set(key, [...(byDay.get(key) ?? []), match]);
  }

  const activeQuery = Object.fromEntries(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const dayHref = (value: string) => `${action}?${new URLSearchParams({ ...activeQuery, giorno: value }).toString()}`;

  const stages = bundle.competitions.flatMap((competition) => competition.stages.map((stage) => ({ value: String(stage.id), label: bundle.competitions.length > 1 ? `${competition.name} · ${stage.name}` : stage.name })));
  const groupNames = [...new Set(bundle.competitions.flatMap((competition) => competition.stages.flatMap((stage) => stage.groups.map((group) => group.name))))];
  const fields: FilterField[] = [
    { name: 'competizione', label: m.calendar.competition, anyLabel: m.calendar.any, value: filters.competizione ?? '', options: bundle.competitions.map((item) => ({ value: item.slug, label: item.name })) },
    { name: 'fase', label: m.calendar.stage, anyLabel: m.calendar.any, value: filters.fase ?? '', options: stages },
    { name: 'girone', label: m.calendar.group, anyLabel: m.calendar.anyState, value: filters.girone ?? '', options: groupNames.map((name) => ({ value: name, label: fmt(m.match.group, { group: name }) })) },
    { name: 'squadra', label: m.calendar.team, anyLabel: m.calendar.any, value: filters.squadra ?? '', options: bundle.teams.map((team) => ({ value: team.slug, label: team.name })) },
    { name: 'stato', label: m.calendar.state, anyLabel: m.calendar.anyState, value: filters.stato ?? '', options: MATCH_STATUSES.map((status: MatchStatus) => ({ value: status, label: m.status[status] })) },
  ];

  const nextMatch = bundle.matches.filter((match) => match.status === 'scheduled' && match.kickoffAt && match.kickoffAt > new Date().toISOString()).sort(byKickoff)[0];
  const chip = 'kicker inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm whitespace-nowrap';

  return (
    <>
      <PageHeader compact title={m.calendar.title}>
        <div className="flex flex-wrap items-center gap-3">
          <FollowedFilter action={action} teams={bundle.teams.map((team) => ({ slug: team.slug, name: team.name }))} label={m.calendar.onlyFollowed} active={filters.squadra} />
          <PrintButton label={m.calendar.print} />
          {edition.config.links.tuttocampo_url ? (
            <a href={edition.config.links.tuttocampo_url} rel="noopener" className="no-print inline-flex min-h-11 items-center font-semibold text-link underline">
              {m.calendar.seeOnTuttocampo}
            </a>
          ) : null}
        </div>
      </PageHeader>

      <div className="container-page space-y-6 pb-10">
        {bundle.matches.length === 0 ? (
          <EmptyState title={m.calendar.empty} />
        ) : (
          <>
            <nav aria-label={m.calendar.day} className="no-print">
              <ul className="rail gap-2 py-1">
                <li>
                  <Link href={dayHref(ALL_DAYS)} aria-current={day === ALL_DAYS ? 'true' : undefined} className={cx(chip, day === ALL_DAYS ? 'bg-inverse text-on-inverse' : 'border border-line')}>
                    {m.calendar.allDays}
                  </Link>
                </li>
                {allDays.map((item) => (
                  <li key={item}>
                    <Link href={dayHref(item)} aria-current={day === item ? 'true' : undefined} className={cx(chip, day === item ? 'bg-inverse text-on-inverse' : item === today ? 'border-2 border-ink' : 'border border-line')}>
                      {dayLabel(item, today)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* I filtri stanno in un pannello richiudibile: su telefono prima vengono le partite. */}
            <details open={anyFilter} className="no-print group rounded-card border border-line">
              <summary className="kicker flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm [&::-webkit-details-marker]:hidden">
                {m.calendar.filters}
                <ChevronDown aria-hidden className="size-5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-line p-4">
                <CalendarFilters action={action} fields={fields} hidden={day === ALL_DAYS || !requestedDay ? {} : { giorno: day }} labels={{ title: m.calendar.filters, apply: m.calendar.apply, reset: m.calendar.reset }} hasFilters={anyFilter} />
              </div>
            </details>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="text-sm text-muted" aria-live="polite">
                {countLabel(visible.length, m.calendar.countOne, m.calendar.count)}
              </p>
              <DataFreshness generatedAt={snapshot.generatedAt} degraded={snapshot.degraded} />
            </div>

            {visible.length === 0 ? (
              <EmptyState title={anyFilter ? m.calendar.emptyFiltered : nextMatch?.kickoffAt ? fmt(m.calendar.restToday, { date: formatRome(nextMatch.kickoffAt, 'dayLong'), time: formatRome(nextMatch.kickoffAt, 'time') }) : m.calendar.restNoNext} />
            ) : (
              <div className="space-y-8 print:hidden">
                {[...byDay.entries()].map(([key, dayMatches]) => (
                  <section key={key || 'senza-data'} aria-labelledby={`giorno-${key || 'x'}`}>
                    <h2 id={`giorno-${key || 'x'}`} className="mb-3 flex flex-wrap items-baseline gap-x-3 border-b-2 border-ink pb-1.5 text-2xl">
                      {key ? (
                        <>
                          <span>{formatRome(dateKeyToInstant(key), 'dayLong')}</span>
                          <span className="kicker text-xs text-muted">{fmt(m.calendar.evening, { n: allDays.indexOf(key) + 1 })}</span>
                        </>
                      ) : (
                        m.match.timeTbd
                      )}
                    </h2>
                    <ul className="grid gap-3 lg:grid-cols-2">
                      {dayMatches.map((match) => (
                        <li key={match.id}>
                          <MatchCard match={match} year={edition.year} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            {/* Versione per la stampa: il calendario intero su un foglio A4, con il logo (brief 7.2). */}
            <div className="hidden print:block">
              <div className="mb-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- immagine statica solo per la stampa */}
                <img src="/brand/logo-160.webp" alt="" width={56} height={56} />
                <p className="display text-2xl">{fmt(m.calendar.printTitle, { edition: edition.name })}</p>
              </div>
              <table className="w-full border-collapse text-[9pt] tabular-nums">
                <tbody>
                  {filtered.map((match) => (
                    <tr key={match.id} className="border-b border-line">
                      <td className="py-0.5 pr-2 whitespace-nowrap">{match.kickoffAt ? formatRome(match.kickoffAt, 'dateTime') : ''}</td>
                      <td className="pr-2 whitespace-nowrap">{match.shortLabel}</td>
                      <td className="pr-2 text-right font-semibold">{match.home?.name ?? match.homePlaceholder}</td>
                      <td className="px-1 text-center font-semibold whitespace-nowrap">{hasScore(match) ? `${match.homeScore} - ${match.awayScore}` : '-'}</td>
                      <td className="pr-2 font-semibold">{match.away?.name ?? match.awayPlaceholder}</td>
                      <td className="whitespace-nowrap">{match.status === 'scheduled' ? '' : m.status[match.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
