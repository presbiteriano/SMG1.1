'use client';

import { useEffect } from 'react';
import text from '@/lib/i18n/messages/it.client.json';

// 500 con il tono del torneo. Mai pagina bianca (brief 10).
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="container-page py-10">
      <div className="floodlit rounded-card px-6 py-12 sm:px-10">
        <h1 className="text-5xl sm:text-6xl">{text.errorTitle}</h1>
        <p className="mt-3 max-w-xl text-lg">{text.errorText}</p>
        <button type="button" onClick={reset} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-inverse px-5 font-display text-lg font-bold text-on-inverse uppercase">
          {text.errorCta}
        </button>
      </div>
    </main>
  );
}
