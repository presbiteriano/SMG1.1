'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/lib/ui';

export type TabItem = { href: string; label: string; exact?: boolean };

/** Schede di navigazione a scorrimento orizzontale: quella della pagina aperta è sottolineata e annunciata. */
export function TabLinks({ items, label }: { items: TabItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="no-print border-b border-line">
      <ul className="container-page rail gap-1">
        {items.map((item) => {
          const path = item.href.split('?')[0];
          const active = item.exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx('display inline-flex min-h-11 items-center border-b-[3px] px-2.5 text-lg', active ? 'border-ink' : 'border-transparent text-muted hover:text-text')}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
