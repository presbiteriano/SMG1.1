import { PageHeader } from '@/components/ui';
import type { SiteSettings } from '@/lib/config/site-settings';
import { fmt, m } from '@/lib/i18n';

type Section = { title: string; body: string[] };

/**
 * Pagine legali (brief 7.12): il testo è un modello fornito dallo sviluppatore, da far verificare
 * a un consulente. Finché il titolare non spunta «verificate» nelle impostazioni, la pagina lo dichiara.
 */
export function LegalPage({ title, intro, sections, settings }: { title: string; intro: string; sections: Section[]; settings: SiteSettings }) {
  const values = {
    brand: m.brand.name,
    controller: settings.controller_name ?? m.legal.controllerMissing,
    email: settings.removal_email ?? settings.contact_email ?? m.legal.emailMissing,
  };
  return (
    <>
      <PageHeader title={title} question={fmt(intro, values)} />
      <div className="container-page max-w-3xl space-y-8 pb-10">
        {settings.legal_reviewed ? null : (
          <p role="note" className="rounded-xl border-2 border-dashed border-ink p-4 font-semibold">
            {m.legal.draftNotice}
          </p>
        )}
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-3 text-2xl">{section.title}</h2>
            <div className="space-y-3 text-[1.0625rem] leading-relaxed">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{fmt(paragraph, values)}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
