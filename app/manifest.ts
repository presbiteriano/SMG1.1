import type { MetadataRoute } from 'next';
import { m } from '@/lib/i18n';
import { BRAND } from '@/lib/tokens/brand';

// Installabile come app (brief 8). Le icone derivano dal logo ricevuto: vedi scripts/make-icons.mjs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: m.pwa.name,
    short_name: m.pwa.shortName,
    description: m.pwa.description,
    lang: 'it',
    start_url: '/?da=app',
    scope: '/',
    display: 'standalone',
    background_color: BRAND.white,
    theme_color: BRAND.sky,
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
