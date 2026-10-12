import { BRAND } from '@/lib/tokens/brand';

// Immagini di esempio generate dal programma: forme astratte, nessuna persona, nessuna scritta.
// Servono a provare stemmi e galleria senza usare foto vere (che richiedono il flusso di consenso).

function shade(hex: string, amount: number): string {
  const value = hex.replace('#', '');
  const channel = (index: number) => {
    const base = parseInt(value.slice(index, index + 2), 16);
    const mixed = amount < 0 ? base * (1 + amount) : base + (255 - base) * amount;
    return Math.round(Math.max(0, Math.min(255, mixed)))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

/** Stemma di esempio: scudo nel colore della maglia con un motivo che cambia da squadra a squadra. */
export function crestSvg(kitColor: string, code: string): string {
  const dark = shade(kitColor, -0.35);
  const light = shade(kitColor, 0.55);
  const motif = code.charCodeAt(0) % 3;
  const inner =
    motif === 0
      ? `<path d="M60 150 Q120 110 180 150 T300 150" fill="none" stroke="${light}" stroke-width="16" stroke-linecap="round" transform="translate(-60 20)"/><path d="M60 150 Q120 110 180 150 T300 150" fill="none" stroke="${light}" stroke-width="16" stroke-linecap="round" transform="translate(-60 70)"/>`
      : motif === 1
        ? `<path d="M120 70 L120 250 M78 110 L162 110" stroke="${light}" stroke-width="18" stroke-linecap="round"/>`
        : `<path d="M120 62 L138 120 L198 120 L150 156 L168 214 L120 178 L72 214 L90 156 L42 120 L102 120 Z" fill="${light}"/>`;
  const shield = 'M20 16 H220 V150 C220 214 176 250 120 268 C64 250 20 214 20 150 Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="560" viewBox="0 0 240 280">
  <defs><clipPath id="scudo"><path d="${shield}"/></clipPath></defs>
  <path d="${shield}" fill="${kitColor}"/>
  <g clip-path="url(#scudo)">${inner}</g>
  <path d="${shield}" fill="none" stroke="${dark}" stroke-width="12" stroke-linejoin="round"/>
</svg>`;
}

/** «Foto» di esempio: campo di notte sotto i riflettori, in sei varianti. */
export function photoSvg(index: number): string {
  const width = 1600;
  const height = 1067;
  const glowX = [320, 1280, 800, 420, 1180, 800, 300, 1300][index % 8];
  const pitch = ['#12351f', '#0f2e1b', '#153a22', '#102c1a'][index % 4];
  const lines =
    index % 3 === 0
      ? `<circle cx="800" cy="760" r="170" fill="none" stroke="${BRAND.white}" stroke-opacity="0.75" stroke-width="7"/><path d="M0 760 H1600" stroke="${BRAND.white}" stroke-opacity="0.75" stroke-width="7"/>`
      : index % 3 === 1
        ? `<path d="M520 1067 V700 H1080 V1067 M680 1067 V850 H920 V1067" fill="none" stroke="${BRAND.white}" stroke-opacity="0.75" stroke-width="7"/>`
        : `<path d="M0 640 H1600 M1300 640 V1067" fill="none" stroke="${BRAND.white}" stroke-opacity="0.75" stroke-width="7"/><path d="M1300 900 A160 160 0 0 0 1460 1060" fill="none" stroke="${BRAND.white}" stroke-opacity="0.75" stroke-width="7"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BRAND.ink}"/>
      <stop offset="1" stop-color="#16324a"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${BRAND.white}" stop-opacity="0.95"/>
      <stop offset="0.25" stop-color="${BRAND.sky}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${BRAND.sky}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#sky)"/>
  <rect y="600" width="${width}" height="467" fill="${pitch}"/>
  <ellipse cx="${glowX}" cy="170" rx="520" ry="330" fill="url(#glow)"/>
  <ellipse cx="${width - glowX}" cy="140" rx="360" ry="230" fill="url(#glow)" opacity="0.7"/>
  <rect x="${glowX - 6}" y="170" width="12" height="430" fill="${BRAND.ink}"/>
  <rect x="${glowX - 70}" y="130" width="140" height="56" rx="8" fill="${BRAND.ink}"/>
  ${lines}
</svg>`;
}
