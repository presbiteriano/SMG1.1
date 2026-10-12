import localFont from 'next/font/local';

// Caratteri con licenza libera (OFL) serviti dal nostro dominio: nessun dato dei visitatori va a terzi (brief 4.4).

/** Titoli e numeri: condensato, come i banner del torneo. */
export const displayFont = localFont({
  src: [
    { path: './fonts/barlow-condensed-700.woff2', weight: '700', style: 'normal' },
    { path: './fonts/barlow-condensed-800.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-barlow',
  display: 'swap',
  fallback: ['Arial Narrow', 'Arial', 'sans-serif'],
});

/** Testo: leggibile su schermi piccoli, con le lettere accentate dell'italiano. */
export const textFont = localFont({
  src: [
    { path: './fonts/inter-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/inter-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', 'Arial', 'sans-serif'],
});
