'use client';

// Ultima rete di sicurezza: se si rompe anche l'impaginazione di base, resta una pagina leggibile.
// Qui i fogli di stile e il file dei messaggi potrebbero non essere disponibili: testo e stile sono minimi.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="it">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', lineHeight: 1.5 }}>
        <h1>Palla in tribuna.</h1>
        <p>Qualcosa non ha funzionato. Riprova tra un attimo: i risultati sono al sicuro.</p>
        <button type="button" onClick={reset} style={{ minHeight: 44, padding: '0 1.25rem', fontSize: '1rem' }}>
          Riprova
        </button>
      </body>
    </html>
  );
}
