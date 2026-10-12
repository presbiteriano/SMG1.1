import { MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import { buttonClass, PageHeader, SectionHeading, TextLink } from '@/components/ui';
import { phoneHref } from '@/lib/config/site-settings';
import { getEdition, getSite } from '@/lib/data/queries';
import { fmt, m } from '@/lib/i18n';
import { editionDates } from '@/lib/site';

export const metadata: Metadata = { title: m.info.title, description: m.info.question };

const rowLink = 'inline-flex min-h-11 items-center font-semibold text-link underline';

// Info (brief 7.12): dove, quando, contatti. Le mappe sono un semplice collegamento: nessun contenuto di terzi incorporato.
export default async function InfoPage() {
  const { data: site } = await getSite();
  const { settings } = site;
  const edition = site.featuredYear ? (await getEdition(site.featuredYear)).data?.edition : null;
  const venue = edition?.venue ?? null;
  const mapsUrl = venue?.mapsUrl ?? settings.maps_url;
  const hasContacts = settings.phones.length > 0 || settings.whatsapp_url || settings.instagram_url || settings.contact_email;

  return (
    <>
      <PageHeader title={m.info.title} question={m.info.question} />
      <div className="container-page grid gap-10 pb-10 lg:grid-cols-2">
        <section aria-labelledby="dove" className="floodlit rounded-card p-5 sm:p-7">
          <h2 id="dove" className="text-3xl">
            {m.info.where}
          </h2>
          {venue ? (
            <p className="mt-3 flex items-start gap-2 text-lg font-semibold">
              <MapPin aria-hidden className="mt-1 size-5 shrink-0" />
              <span>
                {venue.name}
                {venue.address ? <span className="block font-normal">{venue.address}</span> : null}
              </span>
            </p>
          ) : null}
          <p className="mt-2">{m.info.nights}</p>
          {mapsUrl ? (
            <>
              <a href={mapsUrl} rel="noopener" className={buttonClass('primary', 'mt-5')}>
                {m.info.directions}
              </a>
              <p className="mt-2 text-sm">{m.info.directionsNote}</p>
            </>
          ) : null}
        </section>

        <div className="space-y-10">
          {edition ? (
            <section aria-labelledby="quando">
              <SectionHeading id="quando" title={m.info.when} />
              <p className="text-lg font-semibold">{edition.name}</p>
              <p className="text-lg">{editionDates(edition)}</p>
            </section>
          ) : null}

          <section aria-labelledby="contatti">
            <SectionHeading id="contatti" title={m.info.contacts} />
            {hasContacts ? (
              <ul className="card divide-y divide-line">
                {settings.phones.map((phone) => (
                  <li key={phone} className="flex flex-wrap items-center justify-between gap-x-4 px-4">
                    <span className="kicker text-xs text-muted">{m.info.phone}</span>
                    <a href={phoneHref(phone)} aria-label={fmt(m.info.call, { phone })} className={rowLink}>
                      {phone}
                    </a>
                  </li>
                ))}
                {settings.whatsapp_url ? (
                  <li className="px-4 py-1">
                    <a href={settings.whatsapp_url} rel="noopener" className={rowLink}>
                      {m.info.whatsapp}
                    </a>
                    <p className="pb-2 text-sm text-muted">{m.info.whatsappNote}</p>
                  </li>
                ) : null}
                {settings.instagram_url ? (
                  <li className="flex flex-wrap items-center justify-between gap-x-4 px-4">
                    <span className="kicker text-xs text-muted">{m.info.instagram}</span>
                    <a href={settings.instagram_url} rel="noopener" className={rowLink}>
                      {settings.instagram_handle ?? m.info.instagram}
                    </a>
                  </li>
                ) : null}
                {settings.contact_email ? (
                  <li className="flex flex-wrap items-center justify-between gap-x-4 px-4">
                    <span className="kicker text-xs text-muted">{m.info.email}</span>
                    <a href={`mailto:${settings.contact_email}`} className={rowLink}>
                      {settings.contact_email}
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="text-muted">{m.info.contactsEmpty}</p>
            )}
          </section>

          <section aria-labelledby="documenti">
            <SectionHeading id="documenti" title={m.info.documents} />
            <ul>
              <li>
                <TextLink href="/regolamento">{m.nav.rules}</TextLink>
              </li>
              {settings.consent_form_url ? (
                <li>
                  <a href={settings.consent_form_url} className={rowLink}>
                    {m.info.consentForm}
                  </a>
                </li>
              ) : null}
              <li>
                <TextLink href="/rimozione-contenuti">{m.nav.removal}</TextLink>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
