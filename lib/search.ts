import { foldText } from './slug';

// Ricerca su un indice piccolo, caricato solo quando serve (brief 8): tollera accenti e errori di battitura.

export type SearchEntry = {
  /** team | player | match */
  kind: 'team' | 'player' | 'match';
  label: string;
  detail: string;
  href: string;
};

function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      best = Math.min(best, current[j]);
    }
    if (best > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

/** Quanto bene una parola cercata corrisponde a una parola dell'indice: 0 = nessuna corrispondenza. */
function wordScore(query: string, word: string): number {
  if (word === query) return 4;
  if (word.startsWith(query)) return 3;
  if (query.length >= 3 && word.includes(query)) return 2;
  const tolerance = query.length >= 8 ? 2 : query.length >= 4 ? 1 : 0;
  if (tolerance > 0 && distance(query, word, tolerance) <= tolerance) return 1;
  return 0;
}

export function searchEntries(entries: SearchEntry[], rawQuery: string, limit = 12): SearchEntry[] {
  const words = foldText(rawQuery)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (words.length === 0 || words.join('').length < 2) return [];
  const kindWeight = { team: 3, player: 2, match: 1 } as const;
  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    const haystack = foldText(`${entry.label} ${entry.detail}`)
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    let total = 0;
    let all = true;
    for (const word of words) {
      const best = Math.max(0, ...haystack.map((candidate) => wordScore(word, candidate)));
      if (best === 0) {
        all = false;
        break;
      }
      total += best;
    }
    if (all) scored.push({ entry, score: total * 10 + kindWeight[entry.kind] });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label, 'it'))
    .slice(0, limit)
    .map((item) => item.entry);
}
