'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Tre piccoli lavori che girano dietro le quinte del sito pubblico.

/**
 * Aggiornamenti live leggeri (brief 8): niente websocket. Ogni `intervalMs` il browser chiede
 * se qualcosa è cambiato, solo se la pagina è visibile; se sì, ricarica i dati senza perdere la posizione.
 */
export function LivePoller({ year, stamp, intervalMs }: { year: number; stamp: string; intervalMs: number }) {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch(`/api/live?anno=${year}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { stamp: string };
        if (!cancelled && data.stamp !== stamp) router.refresh();
      } catch {
        // senza rete si riprova al prossimo giro
      }
    };
    const timer = window.setInterval(check, intervalMs);
    document.addEventListener('visibilitychange', check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [year, stamp, intervalMs, router]);
  return null;
}

let firstView = true;

function send(payload: Record<string, unknown>): void {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  // Chi ha chiesto di non essere tracciato non viene contato, nemmeno in forma aggregata.
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl) return;
  const body = JSON.stringify(payload);
  if (!navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) {
    fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  }
}

/** Conta un evento (per esempio una condivisione). Nessun cookie, nessun identificativo. */
export function track(event: 'share'): void {
  send({ event });
}

/** Statistiche di visita senza cookie (brief 8): una pagina vista per ogni navigazione. */
export function VisitBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    const entry = firstView;
    firstView = false;
    let external = false;
    try {
      external = !document.referrer || new URL(document.referrer).origin !== window.location.origin;
    } catch {
      external = true;
    }
    const query = new URLSearchParams(window.location.search);
    send({
      event: 'pageview',
      path: pathname,
      entry: entry && external,
      referrer: entry ? document.referrer : '',
      tag: entry ? (query.get('da') ?? query.get('utm_source') ?? '') : '',
    });
  }, [pathname]);
  return null;
}

/** Installabile (PWA): registra il service worker, solo in produzione. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
