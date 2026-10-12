'use client';

import { useSyncExternalStore } from 'react';

// Preferenze salvate sul telefono, senza account e senza cookie (brief 8):
// la squadra seguita e l'ultima edizione guardata.

export const FOLLOW_KEY = 'smg.follow';
export const EDITION_KEY = 'smg.edition';

const EVENT = 'smg:stored';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // navigazione privata o memoria bloccata: il sito funziona lo stesso
  }
}

/** Valore salvato; sul server e al primo disegno è null, così l'HTML coincide. */
export function useStored(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
}

export function setStored(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // niente da fare: la preferenza non verrà ricordata
  }
  window.dispatchEvent(new Event(EVENT));
}
