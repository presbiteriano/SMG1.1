import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import type { AnnouncementDTO } from '@/lib/data/dto';
import { m } from '@/lib/i18n';
import { cx } from '@/lib/ui';

// Banner avvisi in cima a ogni pagina, per rinvii e maltempo (brief 8). La gravità si legge dal
// testo e dall'icona, non solo dal colore.

const STYLES = {
  info: 'bg-surface-2 text-text',
  warning: 'bg-accent text-on-accent',
  critical: 'bg-inverse text-on-inverse on-dark',
} as const;

const ICONS = { info: Info, warning: TriangleAlert, critical: CircleAlert } as const;

/** Avvisi validi in questo momento, dal più grave al meno grave. */
export function activeAnnouncements(items: AnnouncementDTO[], now: Date): AnnouncementDTO[] {
  const weight = { critical: 0, warning: 1, info: 2 } as const;
  const time = now.getTime();
  return items
    .filter((item) => Date.parse(item.startsAt) <= time && (item.endsAt === null || Date.parse(item.endsAt) > time))
    .sort((a, b) => weight[a.severity] - weight[b.severity] || Date.parse(b.startsAt) - Date.parse(a.startsAt));
}

export function AnnouncementBanner({ items }: { items: AnnouncementDTO[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={m.announcement.region} className="no-print">
      {items.slice(0, 2).map((item) => {
        const Icon = ICONS[item.severity];
        return (
          <div key={item.id} role={item.severity === 'info' ? 'status' : 'alert'} className={cx('border-b border-ink/10', STYLES[item.severity])}>
            <div className="container-page flex items-start gap-3 py-2.5">
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={2.4} />
              <p className="min-w-0 flex-1 text-sm">
                <span className="kicker mr-2 text-xs">{m.announcement[item.severity]}</span>
                <strong className="font-semibold">{item.title}</strong>
                {item.body ? <span> · {item.body}</span> : null}
              </p>
              {item.link ? (
                <Link href={item.link} className="kicker shrink-0 self-center text-xs underline underline-offset-4">
                  {m.announcement.more}
                </Link>
              ) : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}
