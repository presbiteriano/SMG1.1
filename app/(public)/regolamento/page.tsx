import { FileDown } from 'lucide-react';
import type { Metadata } from 'next';
import { RichText } from '@/components/sections';
import { buttonClass, EmptyState, PageHeader, SectionHeading } from '@/components/ui';
import { getDocument, getEdition, getSite } from '@/lib/data/queries';
import { formatRome } from '@/lib/datetime';
import { fmt, m } from '@/lib/i18n';

export const metadata: Metadata = { title: m.rules.title, description: m.rules.question };

// Regolamento (brief 7.12): testo in pagina, PDF scaricabile, data di ultima revisione.
// Il riepilogo «In breve» nasce dalle regole dell'edizione: se cambiano nel pannello, cambia anche qui.
export default async function RulesPage() {
  const [{ data: site }, { data: document }] = await Promise.all([getSite(), getDocument('regolamento')]);
  const edition = site.featuredYear ? (await getEdition(site.featuredYear)).data?.edition : null;
  const config = edition?.config;
  const pdf = document?.fileUrl ?? edition?.rulesUrl ?? null;
  const criteria = config
    ? config.tiebreakers
        .filter((criterion) => criterion !== 'points')
        .map((criterion) => fmt(m.standings.criteria[criterion], config.fair_play))
        .join(', ')
    : '';

  return (
    <>
      <PageHeader title={m.rules.title} question={m.rules.question}>
        <div className="flex flex-wrap items-center gap-4">
          {pdf ? (
            <a href={pdf} className={buttonClass('outline')}>
              <FileDown aria-hidden className="size-5" />
              {m.rules.download}
            </a>
          ) : null}
          {document?.revisedAt ? <p className="text-sm text-muted">{fmt(m.rules.revised, { date: formatRome(document.revisedAt, 'date') })}</p> : null}
        </div>
      </PageHeader>

      <div className="container-page grid gap-10 pb-10 lg:grid-cols-[3fr_2fr]">
        <div>{document && document.body.trim() ? <RichText body={document.body} /> : <EmptyState title={m.rules.empty} />}</div>

        {config && edition ? (
          <aside aria-labelledby="in-breve">
            <SectionHeading id="in-breve" title={m.rules.summaryTitle} />
            <dl className="card divide-y divide-line">
              <div className="p-4">
                <dt className="kicker text-xs text-muted">{m.rules.format}</dt>
                <dd className="mt-1">
                  {fmt(m.hub.formatText, { groups: config.groups, qualify: config.qualify_per_group })}
                  {config.format.players_on_field ? ` ${fmt(m.hub.formatOnField, { n: config.format.players_on_field })}` : ''}
                  {config.format.halves && config.format.half_minutes ? ` ${fmt(m.hub.formatTime, { halves: config.format.halves, minutes: config.format.half_minutes })}` : ''}
                </dd>
              </div>
              <div className="p-4">
                <dt className="kicker text-xs text-muted">{m.rules.points}</dt>
                <dd className="mt-1">{fmt(m.standings.pointsLegend, config.points)}</dd>
              </div>
              <div className="p-4">
                <dt className="kicker text-xs text-muted">{m.rules.tiebreak}</dt>
                <dd className="mt-1">{fmt(m.standings.criteriaLegend, { criteria })}</dd>
              </div>
              <div className="p-4">
                <dt className="kicker text-xs text-muted">{m.rules.knockout}</dt>
                <dd className="mt-1">{m.rules.knockoutText}</dd>
              </div>
            </dl>
            <p className="mt-2 text-sm text-muted">{edition.name}</p>
          </aside>
        ) : null}
      </div>
    </>
  );
}
