'use client';

import { CalendarDays, Ellipsis, ListOrdered, Menu, Search, Users, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { EDITION_KEY, setStored, useStored } from '@/lib/client/stored';
import type { Messages } from '@/lib/i18n';
import { cx } from '@/lib/ui';

// Cornice del sito: selettore di edizione, header con logo al centro, menu e barra inferiore.
// Il selettore ricorda la scelta: chi sta guardando il 2026 non si ritrova nel 2027 (brief 6).

const SearchDialog = dynamic(() => import('./search-dialog').then((module) => module.SearchDialog), { ssr: false });

export type NavEdition = {
  year: number;
  /** Edizione non ancora iniziata: il selettore porta alla pagina di presentazione. */
  upcoming: boolean;
  competitions: { slug: string; name: string }[];
};

type ChromeProps = {
  editions: NavEdition[];
  featuredYear: number | null;
  nav: Messages['nav'];
  search: Messages['search'];
  brandName: string;
  logoAlt: string;
};

const SelectedYear = createContext<number | null>(null);

function useSelectedYear(editions: NavEdition[], featuredYear: number | null): number | null {
  const params = useParams<{ anno?: string }>();
  const fromUrl = params.anno && /^\d{4}$/.test(params.anno) ? Number(params.anno) : null;
  const stored = Number(useStored(EDITION_KEY));
  const known = (year: number | null) => year !== null && editions.some((edition) => edition.year === year);

  useEffect(() => {
    if (fromUrl) setStored(EDITION_KEY, String(fromUrl));
  }, [fromUrl]);

  if (known(fromUrl)) return fromUrl;
  if (known(stored)) return stored;
  return featuredYear;
}

export function SiteChromeProvider({ editions, featuredYear, children }: { editions: NavEdition[]; featuredYear: number | null; children: ReactNode }) {
  const year = useSelectedYear(editions, featuredYear);
  return <SelectedYear.Provider value={year}>{children}</SelectedYear.Provider>;
}

function editionHref(edition: NavEdition): string {
  return edition.upcoming ? `/${edition.year}` : `/edizioni/${edition.year}`;
}

function sectionHref(year: number | null, section: 'calendario' | 'classifica' | 'tabellone'): string {
  return year ? `/edizioni/${year}/${section}` : `/${section}`;
}

/** Fascia in cima: 2027 | 2026 | Coppa | Supercoppa | Archivio. */
export function EditionTabs({ editions, nav }: Pick<ChromeProps, 'editions' | 'nav'>) {
  const year = useContext(SelectedYear);
  const pathname = usePathname();
  const selected = editions.find((edition) => edition.year === year);
  const tab = 'kicker inline-flex min-h-11 shrink-0 items-center border-b-[3px] px-3 text-sm whitespace-nowrap';
  return (
    <nav aria-label={nav.editions} className="no-print on-dark bg-inverse text-on-inverse">
      <ul className="container-page rail gap-1">
        {editions.slice(0, 3).map((edition) => {
          const active = edition.year === year && (pathname === `/${edition.year}` || pathname.startsWith(`/edizioni/${edition.year}`));
          return (
            <li key={edition.year}>
              <Link href={editionHref(edition)} aria-current={active ? 'page' : undefined} className={cx(tab, edition.year === year ? 'border-accent text-accent' : 'border-transparent')}>
                {edition.year}
              </Link>
            </li>
          );
        })}
        {selected?.competitions.map((competition) => (
          <li key={competition.slug}>
            <Link href={`/edizioni/${selected.year}/calendario?competizione=${competition.slug}`} className={cx(tab, 'border-transparent')}>
              {competition.name}
            </Link>
          </li>
        ))}
        <li>
          <Link href="/edizioni" aria-current={pathname === '/edizioni' ? 'page' : undefined} className={cx(tab, pathname === '/edizioni' ? 'border-accent text-accent' : 'border-transparent')}>
            {nav.archive}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function useNavLinks(nav: Messages['nav']) {
  const year = useContext(SelectedYear);
  return {
    left: [
      { href: sectionHref(year, 'calendario'), label: nav.calendar },
      { href: sectionHref(year, 'classifica'), label: nav.standings },
      { href: '/squadre', label: nav.teams },
      { href: year ? `/statistiche?edizione=${year}` : '/statistiche', label: nav.stats },
    ],
    right: [
      { href: '/albo-doro', label: nav.hall },
      { href: '/sponsor', label: nav.sponsors },
      { href: '/info', label: nav.info },
    ],
    more: [
      { href: sectionHref(year, 'tabellone'), label: nav.bracket },
      { href: '/foto', label: nav.photos },
      { href: '/regolamento', label: nav.rules },
      { href: '/iscrizioni', label: nav.register },
      { href: '/edizioni', label: nav.editionsLabel },
    ],
  };
}

const iconButton = 'grid size-11 place-items-center rounded-full transition-colors hover:bg-ink/10';

export function SiteHeader({ nav, search, brandName, logoAlt }: Omit<ChromeProps, 'editions' | 'featuredYear'>) {
  const links = useNavLinks(nav);
  const pathname = usePathname();
  const menu = useRef<HTMLDialogElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const isCurrent = (href: string) => pathname === href.split('?')[0];
  const desktopLink = 'display inline-flex min-h-11 items-center border-b-[3px] px-1 text-lg';

  // «Altro» nella barra inferiore apre lo stesso menu.
  useEffect(() => {
    const open = () => menu.current?.showModal();
    window.addEventListener('smg:menu', open);
    return () => window.removeEventListener('smg:menu', open);
  }, []);

  return (
    <header className="no-print bg-accent text-on-accent">
      <div className="container-page grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 md:h-20">
        <div className="flex items-center gap-5">
          <button type="button" className={cx(iconButton, 'md:hidden')} aria-label={nav.menu} onClick={() => menu.current?.showModal()}>
            <Menu aria-hidden className="size-6" />
          </button>
          <nav aria-label={nav.main} className="hidden md:block">
            <ul className="flex items-center gap-5">
              {links.left.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} aria-current={isCurrent(link.href) ? 'page' : undefined} className={cx(desktopLink, isCurrent(link.href) ? 'border-ink' : 'border-transparent hover:border-ink/40')}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <Link href="/" className="flex items-center justify-center rounded-full" aria-label={`${brandName}: ${nav.home}`}>
          <Image src="/brand/logo-160.webp" alt={logoAlt} width={72} height={72} priority unoptimized className="size-14 md:size-[4.5rem]" />
        </Link>

        <div className="flex items-center justify-end gap-5">
          <ul className="hidden items-center gap-5 md:flex">
            {links.right.map((link) => (
              <li key={link.href}>
                <Link href={link.href} aria-current={isCurrent(link.href) ? 'page' : undefined} className={cx(desktopLink, isCurrent(link.href) ? 'border-ink' : 'border-transparent hover:border-ink/40')}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <button type="button" className={iconButton} aria-label={nav.search} onClick={() => setSearchOpen(true)}>
            <Search aria-hidden className="size-6" />
          </button>
        </div>
      </div>

      <dialog
        ref={menu}
        aria-label={nav.menu}
        className="m-0 ml-auto h-dvh max-h-none w-[min(22rem,88vw)] max-w-none bg-surface p-0 text-text shadow-pop backdrop:bg-ink/60"
        onClick={(event) => {
          // Un tocco fuori dal pannello o su un collegamento chiude il menu.
          if (event.target === event.currentTarget || (event.target as HTMLElement).closest('a')) event.currentTarget.close();
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="display text-2xl">{nav.menu}</p>
            <button type="button" className={iconButton} aria-label={nav.closeMenu} onClick={() => menu.current?.close()}>
              <X aria-hidden className="size-6" />
            </button>
          </div>
          <nav aria-label={nav.main} className="flex-1 overflow-y-auto px-2 py-2">
            <ul>
              {[...links.left, ...links.right, ...links.more].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="display flex min-h-12 items-center rounded-lg px-3 text-2xl hover:bg-surface-2">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </dialog>

      {searchOpen ? <SearchDialog labels={search} onClose={() => setSearchOpen(false)} /> : null}
    </header>
  );
}

/** Barra inferiore su telefono: i pollici lavorano in basso (brief 6). */
export function BottomNav({ nav }: Pick<ChromeProps, 'nav'>) {
  const year = useContext(SelectedYear);
  const pathname = usePathname();
  const items = [
    { href: sectionHref(year, 'calendario'), label: nav.results, icon: CalendarDays },
    { href: sectionHref(year, 'classifica'), label: nav.standings, icon: ListOrdered },
    { href: '/squadre', label: nav.teams, icon: Users },
  ];
  const cell = 'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold';
  return (
    <nav aria-label={nav.bottom} className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex">
        {items.map((item) => {
          const active = pathname === item.href || (item.href === '/squadre' && pathname.startsWith('/squadre'));
          return (
            <li key={item.href} className="flex flex-1">
              <Link href={item.href} aria-current={active ? 'page' : undefined} className={cx(cell, active && 'shadow-[inset_0_3px_0_var(--smg-ink)]')}>
                <item.icon aria-hidden className="size-5" strokeWidth={active ? 2.6 : 2} />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <button type="button" className={cell} onClick={() => window.dispatchEvent(new Event('smg:menu'))}>
            <Ellipsis aria-hidden className="size-5" />
            {nav.more}
          </button>
        </li>
      </ul>
    </nav>
  );
}
