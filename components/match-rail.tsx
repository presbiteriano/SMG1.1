import type { MatchDTO } from '@/lib/data/dto';
import { MatchTile } from './match-card';
import { RailFocus } from './rail-focus';

/**
 * MatchRail: striscia orizzontale sotto l'header con ultime partite, partita in corso e prossime.
 * Si centra da sola sulla partita in corso (o sulla prossima). L'altezza è fissa: nessuno spostamento
 * di layout al caricamento (brief 7.1).
 */
export function MatchRail({ matches, year, focusId, label }: { matches: MatchDTO[]; year: number; focusId: number | null; label: string }) {
  if (matches.length === 0) return null;
  return (
    <section aria-label={label} className="no-print border-b border-line bg-surface-2">
      <div className="container-page">
        <ul className="rail gap-3 py-3">
          {matches.map((match) => (
            <li key={match.id} id={`rail-${match.id}`} className="flex snap-start">
              <MatchTile match={match} year={year} />
            </li>
          ))}
        </ul>
      </div>
      {focusId ? <RailFocus targetId={`rail-${focusId}`} /> : null}
    </section>
  );
}
