import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { siteUrl } from '@/lib/env';
import { m } from '@/lib/i18n';
import { BRAND } from '@/lib/tokens/brand';
import { displayFont, textFont } from '@/lib/tokens/fonts';
import './globals.css';

// Le pagine si generano sul server a ogni richiesta, leggendo dati in cache per etichetta
// (lib/data/queries.ts): così la Content-Security-Policy può usare un nonce per richiesta
// e un risultato salvato dal pannello è subito visibile. Vedi docs/DECISIONI.md.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: m.meta.title, template: `%s · ${m.brand.name}` },
  description: m.meta.description,
  applicationName: m.brand.name,
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    siteName: m.brand.name,
    images: [{ url: '/brand/icon-512.png', width: 512, height: 512, alt: m.brand.logoAlt }],
  },
  twitter: { card: 'summary' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: BRAND.sky,
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" className={`${displayFont.variable} ${textFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
