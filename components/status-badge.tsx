import { Ban, CalendarClock, Check, Clock, Gavel } from 'lucide-react';
import type { MatchStatus } from '@/db/schema/enums';
import { m } from '@/lib/i18n';
import { cx } from '@/lib/ui';

// Lo stato di una partita è sempre scritto in testo, con un'icona: mai solo colore (brief 7.2).

const STYLES: Record<MatchStatus, string> = {
  scheduled: 'border border-line text-muted',
  live: 'bg-inverse text-on-inverse',
  finished: 'bg-surface-2 text-text',
  postponed: 'border border-dashed border-ink text-text',
  cancelled: 'border border-line text-muted line-through',
  forfeited: 'border border-ink text-text',
};

const ICONS = { scheduled: Clock, finished: Check, postponed: CalendarClock, cancelled: Ban, forfeited: Gavel } as const;

export function LiveDot({ className }: { className?: string }) {
  return <span aria-hidden className={cx('inline-block size-2 rounded-full bg-accent animate-pulse-ring', className)} />;
}

export function StatusBadge({ status, long = false, className }: { status: MatchStatus; long?: boolean; className?: string }) {
  const Icon = status === 'live' ? null : ICONS[status];
  const label = status === 'live' && long ? m.status.liveNow : m.status[status];
  return (
    <span className={cx('kicker inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs whitespace-nowrap', STYLES[status], className)}>
      {Icon ? <Icon aria-hidden className="size-3.5" strokeWidth={2.5} /> : <LiveDot />}
      {label}
    </span>
  );
}
