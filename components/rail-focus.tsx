'use client';

import { useEffect } from 'react';

/** Porta al centro della striscia la partita in corso, senza spostare la pagina in verticale. */
export function RailFocus({ targetId }: { targetId: string }) {
  useEffect(() => {
    const item = document.getElementById(targetId);
    const rail = item?.parentElement;
    if (!item || !rail) return;
    rail.scrollLeft = item.offsetLeft - rail.offsetLeft - (rail.clientWidth - item.clientWidth) / 2;
  }, [targetId]);
  return null;
}
