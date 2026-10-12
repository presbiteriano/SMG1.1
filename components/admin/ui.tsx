import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MatchDTO } from '@/lib/data/dto';
import { formatRome } from '@/lib/datetime';
import { m } from '@/lib/i18n';
import { cx } from '@/lib/ui';
import { StatusBadge } from '../status-badge';

export function AdminTitle({ title, text, children }: { title: ReactNode; text?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-4xl">{title}</h1>
        {text ? <p className="mt-1.5 max-w-2xl text-muted">{text}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

export function Panel({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('card p-4 sm:p-5', className)}>
      {title ? <h2 className="mb-3 text-2xl">{title}</h2> : null}
      {children}
    </section>
  );
}

export const adminLinkButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-ink px-4 font-display text-base font-bold uppercase tracking-wide';

/** Selettore dell'edizione su cui lavorare: collegamenti semplici, uno per anno. */
export function EditionSwitch({ years, current, base }: { years: number[]; current: number | null; base: string }) {
  if (years.length < 2) return null;
  return (
    <nav aria-label={m.admin.common.edition}>
      <ul className="rail mb-4 gap-2">
        {years.map((year) => (
          <li key={year}>
            <Link
              href={`${base}?edizione=${year}`}
              aria-current={year === current ? 'true' : undefined}
              className={cx('kicker inline-flex min-h-11 items-center rounded-full px-4 text-sm', year === current ? 'bg-inverse text-on-inverse' : 'border border-line')}
            >
              {year}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Riga grande e toccabile: una partita nell'elenco del pannello. */
export function AdminMatchRow({ match }: { match: MatchDTO }) {
  const scored = match.homeScore !== null && match.awayScore !== null;
  return (
    <Link href={`/admin/partite/${match.id}`} className={cx('card flex min-h-20 items-center gap-3 p-3 transition-colors hover:border-ink', match.status === 'live' && 'border-2 border-ink')}>
      <div className="w-14 shrink-0 text-center">
        <p className="display text-2xl">{match.kickoffAt ? formatRome(match.kickoffAt, 'time') : '--:--'}</p>
        <p className="text-xs text-muted">{match.kickoffAt ? formatRome(match.kickoffAt, 'dayShort') : ''}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="kicker truncate text-xs text-muted">{match.label}</p>
        <p className="truncate text-lg font-semibold">
          {match.home?.name ?? match.homePlaceholder} <span className="text-muted">-</span> {match.away?.name ?? match.awayPlaceholder}
        </p>
        <StatusBadge status={match.status} className="mt-1" />
      </div>
      <p className="display shrink-0 text-4xl tabular-nums">{scored ? `${match.homeScore}-${match.awayScore}` : ''}</p>
    </Link>
  );
}

export const tableClass = 'w-full border-collapse text-left text-sm';
export const thClass = 'kicker border-b border-line px-2 py-2 text-xs text-muted';
export const tdClass = 'border-b border-line px-2 py-2 align-top';
