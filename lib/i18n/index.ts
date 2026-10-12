import it from './messages/it.json';

// Tutte le scritte dell'interfaccia stanno in messages/it.json (brief 8 e 16.3).
// Per aggiungere l'inglese basterà un secondo file con le stesse chiavi: i componenti non cambiano.
export const m = it;
export type Messages = typeof it;

/** Sostituisce i segnaposto {nome} con i valori indicati. */
export function fmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole));
}

/** Sceglie la forma singolare o plurale e inserisce il numero. */
export function countLabel(n: number, one: string, other: string): string {
  return fmt(n === 1 ? one : other, { n });
}
