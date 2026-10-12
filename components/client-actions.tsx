'use client';

import { Download, Printer, Share2 } from 'lucide-react';
import { useState } from 'react';
import type { Messages } from '@/lib/i18n';
import { track } from './site/background';
import { buttonClass } from './ui';

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass('outline', 'no-print')}>
      <Printer aria-hidden className="size-5" />
      {label}
    </button>
  );
}

/**
 * Condividi risultato (brief 8): crea l'immagine per le storie (1080 x 1920). Sul telefono apre
 * il pannello di condivisione; dove non è possibile scarica il file.
 */
export function ShareResult({ matchId, version, text, labels }: { matchId: number; version: number; text: string; labels: Messages['share'] }) {
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  // La versione nell'indirizzo fa da chiave: a ogni cambio di punteggio l'immagine è nuova.
  const imageUrl = `/api/share/${matchId}?formato=storia&v=${version}`;

  async function share() {
    setState('busy');
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('image');
      const file = new File([await response.blob()], `smg-partita-${matchId}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, url: window.location.href });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(file);
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(link.href);
      }
      track('share');
      setState('idle');
    } catch (error) {
      // Chi chiude il pannello di condivisione non ha sbagliato nulla.
      setState(error instanceof DOMException && error.name === 'AbortError' ? 'idle' : 'error');
    }
  }

  return (
    <div className="no-print">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={share} disabled={state === 'busy'} className={buttonClass('primary')}>
          <Share2 aria-hidden className="size-5" />
          {state === 'busy' ? labels.preparing : labels.button}
        </button>
        <a href={imageUrl} download={`smg-partita-${matchId}.png`} className={buttonClass('outline')}>
          <Download aria-hidden className="size-5" />
          {labels.download}
        </a>
      </div>
      <p role="status" className="mt-2 text-sm">
        {state === 'error' ? labels.error : ''}
      </p>
    </div>
  );
}
