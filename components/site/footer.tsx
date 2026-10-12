import Link from 'next/link';
import type { SiteBundle } from '@/lib/data/dto';
import { fmt, m } from '@/lib/i18n';
import { Skyline } from '../skyline';

const linkClass = 'inline-flex min-h-11 items-center underline-offset-4 hover:underline';

export function SiteFooter({ site, year }: { site: SiteBundle; year: number }) {
  const { settings } = site;
  return (
    <footer className="no-print on-dark mt-16 bg-inverse text-on-inverse">
      <Skyline className="-mt-9 text-ink" />
      <div className="container-page grid gap-8 py-10 sm:grid-cols-3">
        <div>
          <p className="display text-3xl text-accent">{m.brand.name}</p>
          <p className="mt-2 max-w-xs text-sm opacity-90">{m.footer.tagline}</p>
          <p className="kicker mt-4 text-xs text-accent">«{m.brand.slogan}»</p>
        </div>
        <nav aria-label={m.footer.tournament}>
          <p className="kicker mb-1 text-xs text-accent">{m.footer.tournament}</p>
          <ul>
            <li>
              <Link href="/edizioni" className={linkClass}>
                {m.nav.editionsLabel}
              </Link>
            </li>
            <li>
              <Link href="/albo-doro" className={linkClass}>
                {m.nav.hall}
              </Link>
            </li>
            <li>
              <Link href="/regolamento" className={linkClass}>
                {m.nav.rules}
              </Link>
            </li>
            <li>
              <Link href="/info" className={linkClass}>
                {m.nav.info}
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="kicker mb-1 text-xs text-accent">{m.footer.follow}</p>
          <ul>
            {settings.instagram_url ? (
              <li>
                <a href={settings.instagram_url} rel="noopener" className={linkClass}>
                  {m.info.instagram} {settings.instagram_handle ?? ''}
                </a>
              </li>
            ) : null}
            {settings.whatsapp_url ? (
              <li>
                <a href={settings.whatsapp_url} rel="noopener" className={linkClass}>
                  {m.info.whatsapp}
                </a>
              </li>
            ) : null}
          </ul>
          <p className="kicker mt-4 mb-1 text-xs text-accent">{m.footer.legal}</p>
          <ul className="flex flex-wrap gap-x-4">
            <li>
              <Link href="/privacy" className={linkClass}>
                {m.nav.privacy}
              </Link>
            </li>
            <li>
              <Link href="/cookie" className={linkClass}>
                {m.nav.cookie}
              </Link>
            </li>
            <li>
              <Link href="/rimozione-contenuti" className={linkClass}>
                {m.nav.removal}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container-page flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4 pb-24 text-sm md:pb-4">
          <p>{fmt(m.footer.rights, { year })}</p>
          {site.hasExampleData ? (
            <p>
              <span className="kicker mr-2 rounded-sm bg-accent px-1.5 py-0.5 text-xs text-on-accent">{m.meta.exampleBadge}</span>
              {m.meta.exampleNote}
            </p>
          ) : null}
          <Link href="/admin" rel="nofollow" className={linkClass}>
            {m.footer.staff}
          </Link>
        </div>
      </div>
    </footer>
  );
}
