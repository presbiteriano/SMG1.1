import type { Metadata } from 'next';
import { Skyline } from '@/components/skyline';
import { m } from '@/lib/i18n';

export const metadata: Metadata = { title: m.errors.offlineTitle, robots: { index: false } };

// Pagina mostrata dal service worker quando non c'è rete e la pagina chiesta non è in memoria.
// Non legge il database: deve poter essere salvata e servita sempre.
export default function OfflinePage() {
  return (
    <main className="container-page py-10">
      <div className="floodlit overflow-hidden rounded-card">
        <div className="px-6 pt-12 pb-6 sm:px-10">
          <h1 className="text-5xl sm:text-6xl">{m.errors.offlineTitle}</h1>
          <p className="mt-3 max-w-xl text-lg">{m.errors.offlineText}</p>
          <a href="" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-inverse px-5 font-display text-lg font-bold text-on-inverse uppercase">
            {m.errors.offlineCta}
          </a>
        </div>
        <Skyline />
      </div>
    </main>
  );
}
