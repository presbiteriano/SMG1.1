/** Unisce classi CSS scartando i valori vuoti. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Colore del testo leggibile sopra un colore di maglia qualunque: nero o bianco, scelto per contrasto.
 * I colori di maglia sono dati delle squadre, non colori dell'interfaccia.
 */
export function readableOn(hex: string | null): 'var(--smg-ink)' | 'var(--smg-white)' {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!match) return 'var(--smg-ink)';
  const channel = (index: number) => {
    const value = parseInt(match[1].slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  // Soglia in cui il contrasto col nero supera quello col bianco.
  return luminance > 0.179 ? 'var(--smg-ink)' : 'var(--smg-white)';
}

export function isHexColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

/** +5, 0, −3: la differenza reti con il segno. */
export function signed(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return '0';
}
