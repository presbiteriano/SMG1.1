/** Indirizzo pubblico del sito, senza barra finale: serve a link di accesso, anteprime social e sitemap. */
export function siteUrl(): string {
  return (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/** I dati di esempio e le scorciatoie di sviluppo non sono mai disponibili in produzione. */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.SMG_ALLOW_EXAMPLE !== '1';
}
