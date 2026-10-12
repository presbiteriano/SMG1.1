/** Testo senza accenti e in minuscolo: serve per la ricerca e per gli indirizzi. */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** «Faro Rovers» diventa «faro-rovers». */
export function slugify(text: string): string {
  return foldText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Sigla di tre lettere proposta a partire dal nome: «Molo Nord» diventa «MOL». */
export function suggestShortCode(name: string): string {
  const letters = foldText(name).replace(/[^a-z]/g, '').toUpperCase();
  return (letters + 'XXX').slice(0, 3);
}
