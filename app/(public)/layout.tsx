import type { ReactNode } from 'react';
import { activeAnnouncements, AnnouncementBanner } from '@/components/announcement-banner';
import { LivePoller, ServiceWorker, VisitBeacon } from '@/components/site/background';
import { BottomNav, EditionTabs, SiteChromeProvider, SiteHeader, type NavEdition } from '@/components/site/chrome';
import { FollowChip } from '@/components/site/follow';
import { SiteFooter } from '@/components/site/footer';
import { getEdition, getSite } from '@/lib/data/queries';
import { romeDateKey } from '@/lib/datetime';
import { m } from '@/lib/i18n';
import { editionStamp, isUpcoming, pollInterval } from '@/lib/site';

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const { data: site } = await getSite();
  const now = new Date();

  const editions: NavEdition[] = site.editions.map((edition) => ({
    year: edition.year,
    upcoming: isUpcoming(edition.status),
    competitions: edition.competitions.map((competition) => ({ slug: competition.slug, name: competition.name })),
  }));

  // Aggiornamento dal browser solo nelle serate di gioco (brief 8).
  const featured = site.featuredYear ? (await getEdition(site.featuredYear)).data : null;
  const interval = pollInterval(featured, now);

  return (
    <SiteChromeProvider editions={editions} featuredYear={site.featuredYear}>
      <a href="#contenuto" className="sr-only z-50 rounded-full bg-inverse px-4 py-3 text-on-inverse focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        {m.nav.skip}
      </a>
      <AnnouncementBanner items={activeAnnouncements(site.announcements, now)} />
      <EditionTabs editions={editions} nav={m.nav} />
      <SiteHeader nav={m.nav} search={m.search} brandName={m.brand.name} logoAlt={m.brand.logoAlt} />
      <FollowChip labels={m.follow} />
      <main id="contenuto" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter site={site} year={Number(romeDateKey(now).slice(0, 4))} />
      <BottomNav nav={m.nav} />
      {featured && interval ? <LivePoller year={featured.edition.year} stamp={editionStamp(featured)} intervalMs={interval} /> : null}
      <VisitBeacon />
      <ServiceWorker />
    </SiteChromeProvider>
  );
}
