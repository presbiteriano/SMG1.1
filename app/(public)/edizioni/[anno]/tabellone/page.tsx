import type { Metadata } from 'next';
import { Bracket } from '@/components/bracket';
import { PrintButton } from '@/components/client-actions';
import { DataFreshness } from '@/components/sections';
import { EmptyState, PageHeader, SectionHeading } from '@/components/ui';
import { bracketRounds } from '@/lib/bracket/view';
import { requireEdition } from '@/lib/data/public';
import { m } from '@/lib/i18n';

export const metadata: Metadata = { title: m.bracket.title, description: m.bracket.question };

// Tabellone di Coppa e Supercoppa (brief 7.4): derivato dalle partite, non è un'immagine.
export default async function BracketPage({ params }: { params: Promise<{ anno: string }> }) {
  const snapshot = await requireEdition((await params).anno);
  const bundle = snapshot.data;
  const brackets = bundle.competitions.map((competition) => ({ competition, rounds: bracketRounds(bundle, competition) })).filter((item) => item.rounds.length > 0);

  return (
    <>
      <PageHeader compact title={m.bracket.title} question={m.bracket.question}>
        {brackets.length > 0 ? <PrintButton label={m.bracket.print} /> : null}
      </PageHeader>
      <div className="container-page space-y-12 pb-10">
        {brackets.length === 0 ? (
          <EmptyState title={m.bracket.empty} />
        ) : (
          brackets.map(({ competition, rounds }) => (
            <section key={competition.id} aria-labelledby={`comp-${competition.id}`}>
              <SectionHeading id={`comp-${competition.id}`} title={competition.name} />
              <Bracket
                rounds={rounds}
                year={bundle.edition.year}
                competitionName={competition.name}
                champion={competition.type === 'supercup' ? bundle.supercupWinner : (bundle.cup?.winner ?? null)}
              />
            </section>
          ))
        )}
        {brackets.length > 0 ? <DataFreshness generatedAt={snapshot.generatedAt} degraded={snapshot.degraded} /> : null}
      </div>
    </>
  );
}
