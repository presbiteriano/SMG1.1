import type { Metadata } from 'next';
import { RemovalForm } from '@/components/public-forms';
import { PageHeader } from '@/components/ui';
import { getSite } from '@/lib/data/queries';
import { m } from '@/lib/i18n';

export const metadata: Metadata = { title: m.legal.removal.title, description: m.legal.removal.question };

// Rimozione contenuti (brief 13.6): modulo dedicato, intervento entro 72 ore, avviso automatico all'organizzatore.
export default async function RemovalPage() {
  const { data: site } = await getSite();
  const email = site.settings.removal_email ?? site.settings.contact_email;
  const [before, after] = m.legal.removal.emailLine.split('{email}');
  return (
    <>
      <PageHeader title={m.legal.removal.title} question={m.legal.removal.question} />
      <div className="container-page max-w-2xl space-y-6 pb-10">
        {site.settings.legal_reviewed ? null : (
          <p role="note" className="rounded-xl border-2 border-dashed border-ink p-4 font-semibold">
            {m.legal.draftNotice}
          </p>
        )}
        <p className="text-lg">{m.legal.removal.intro}</p>
        {email ? (
          <p>
            {before}
            <a href={`mailto:${email}`} className="font-semibold text-link underline">
              {email}
            </a>
            {after}
          </p>
        ) : null}
        <RemovalForm labels={m.legal.removal} readPrivacy={m.registration.readPrivacy} trap={m.registration.trap} />
      </div>
    </>
  );
}
