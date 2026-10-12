'use client';

import { CalendarDays, Ellipsis, ExternalLink, LogOut, Megaphone, Zap } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Messages } from '@/lib/i18n';
import { cx } from '@/lib/ui';

export type AdminLink = { href: string; label: string };

/** Cornice del pannello: pensata per il telefono, in piedi, con una mano (brief 9). */
export function AdminShell({
  children,
  links,
  userName,
  roleLabel,
  labels,
  logoutAction,
  example,
}: {
  children: ReactNode;
  links: AdminLink[];
  userName: string;
  roleLabel: string;
  labels: Messages['admin']['nav'] & { title: string; exampleBadge: string };
  logoutAction: () => Promise<void>;
  example: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`));
  const bottom = [
    { href: '/admin', label: labels.today, icon: Zap },
    { href: '/admin/partite', label: labels.matches, icon: CalendarDays },
    { href: '/admin/avvisi', label: labels.announcements, icon: Megaphone },
    { href: '/admin/altro', label: labels.more, icon: Ellipsis },
  ].filter((item) => item.href === '/admin/altro' || links.some((link) => link.href === item.href));

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="on-dark bg-inverse text-on-inverse">
        <div className="container-page flex min-h-14 items-center justify-between gap-3">
          <Link href="/admin" className="display text-xl whitespace-nowrap text-accent sm:text-2xl">
            {labels.title}
          </Link>
          <div className="flex items-center gap-2 text-sm">
            {example ? <span className="kicker hidden rounded-sm bg-accent px-1.5 py-0.5 text-xs text-on-accent sm:inline">{labels.exampleBadge}</span> : null}
            <span className="hidden sm:inline">{userName}</span>
            <span className="kicker rounded-full border border-white/40 px-2 py-1 text-xs whitespace-nowrap">{roleLabel}</span>
            <Link href="/" className="grid size-11 place-items-center rounded-full hover:bg-white/15" aria-label={labels.site}>
              <ExternalLink aria-hidden className="size-5" />
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="grid size-11 place-items-center rounded-full hover:bg-white/15" aria-label={labels.logout}>
                <LogOut aria-hidden className="size-5" />
              </button>
            </form>
          </div>
        </div>
        <nav aria-label={labels.title} className="hidden border-t border-white/15 md:block">
          <ul className="container-page flex flex-wrap gap-x-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} aria-current={isActive(link.href) ? 'page' : undefined} className={cx('kicker inline-flex min-h-11 items-center border-b-[3px] px-2.5 text-sm', isActive(link.href) ? 'border-accent text-accent' : 'border-transparent')}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="container-page py-5">{children}</main>

      <nav aria-label={labels.title} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="flex">
          {bottom.map((item) => (
            <li key={item.href} className="flex flex-1">
              <Link href={item.href} aria-current={isActive(item.href) ? 'page' : undefined} className={cx('flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold', isActive(item.href) && 'shadow-[inset_0_3px_0_var(--smg-ink)]')}>
                <item.icon aria-hidden className="size-6" strokeWidth={isActive(item.href) ? 2.6 : 2} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
