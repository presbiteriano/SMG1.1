# SMG Summer Cup - istruzioni di progetto

Brief completo: `docs/SMG_Summer_Cup_Brief_Tecnico.pdf` (v1.1; sezioni 1, 5, 10, 11, 13 vincolanti).
Scelte fatte e valori di partenza usati: `docs/DECISIONI.md`. Manuale dell'organizzatore: `docs/MANUALE.md`.

## Cosa è

Sito del torneo di calcetto SMG Summer Cup (Cesenatico): archivio edizioni + sezione 2027 + pannello di gestione.
Mobile-first (si progetta a 390 px). Italiano. Tema chiaro (token pronti per lo scuro, non attivo).

## Regole

- NIENTE scraping di TuttoCampo. NIENTE asset UEFA/Serie A. NIENTE foto/nomi di minori senza consenso.
- Palette: #7CC8FA (sky), #0B0B0B (ink), #FFFFFF; derivati: #1F6F9E (testo su bianco), #EAF6FE.
- MAI testo bianco su #7CC8FA. Sul celeste si scrive in nero.
- Nessun colore scritto a mano nei componenti: solo i token di `lib/tokens/tokens.css` (Tailwind ha la tavolozza predefinita spenta).
- Regole di torneo in `edition.config` (`lib/config/edition-config.ts`), non nel codice. Classifica = calcolata, mai inserita.
- Orari: UTC nel DB, Europe/Rome a schermo. Si formatta solo con `formatRome` (`lib/datetime.ts`).
- Nomi delle persone: si mostrano solo con `publicPersonName` (`lib/people/display-name.ts`).
- Foto: sono pubbliche solo se `isMediaPublic` (`lib/media/visibility.ts`) dice di sì. Si servono solo da `/media/[id]`.
- Dati di gara: entrano solo da `ResultsProvider` (`lib/data/results-provider.ts`), che valida, versiona e registra.
- Valori ignoti: usa il default del brief (sez. 15), rendilo configurabile, annota in `docs/DECISIONI.md` con la data.
- Stringhe UI in `lib/i18n/messages/it.json`. Nessun cookie/terza parte senza approvazione.
- Dati di esempio (sezione 18): sempre `source = 'example'`, mai in produzione, mai dati reali in sviluppo.
- Se una scelta tocca privacy, minorenni, TuttoCampo o marchi altrui: fermati e chiedi.

## Qualità

- LCP <= 2.5 s su 4G lento; CLS <= 0.1; Lighthouse mobile >= 90; WCAG 2.2 AA.
- Test: Vitest (classifica, regole, seed su database vero in memoria), Playwright (mobile, con axe). CI su ogni PR.
- Ogni funzione con logica ha test; i test T1-T12 del brief (16.9) devono restare verdi.

## Comandi

| Comando | Che cosa fa |
| --- | --- |
| `npm run dev` | Sito in sviluppo. Senza `DATABASE_URL` usa il database incorporato in `.data/` e carica l'edizione di esempio. |
| `npm run build` / `npm run start` | Build e avvio di produzione. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | Tipi (TypeScript strict). |
| `npm test` | Test unitari e d'insieme (Vitest). |
| `npm run test:e2e` | Test end-to-end su viewport mobile. `E2E_CHANNEL=chrome` usa il browser già installato. |
| `npm run db:generate` | Genera una migrazione dopo aver cambiato `db/schema/`. |
| `npm run db:migrate` | Applica le migrazioni al database di `DATABASE_URL`. |
| `npm run db:setup` | Primo avvio in produzione: impostazioni di base e accesso del titolare (`OWNER_EMAIL`). |
| `npm run db:seed -- --fase=live` | Edizione di esempio (iscrizioni, programma, live, gironi, conclusa). Mai in produzione. |
| `npm run db:purge-example` | Cancella tutti i dati di esempio. |
| `npm run db:retention` | Pulizia programmata (iscrizioni dopo 12 mesi, anonimizzazione dopo 3 anni). |
| `npm run assets:icons` | Rigenera icone e favicon dal logo in `public/brand/logo-smg.png`. |

## Mappa del codice

- `app/(public)/` sito pubblico; `app/admin/` pannello (protetto, noindex); `app/api/` live, .ics, immagini social, statistiche, esportazioni.
- `components/` MatchCard, MatchRail, StandingsTable, Bracket, StatusBadge...; `components/admin/` pannello.
- `lib/standings/` classifica e spareggi; `lib/bracket/` tabellone; `lib/matches/` regole; `lib/schedule/` generatore di calendario.
- `lib/data/` accesso al database, letture in cache per etichetta (`queries.ts`), invalidazione (`invalidate.ts`).
- `db/schema/` schema Drizzle; `db/migrations/` migrazioni; `db/seed/` edizione di esempio.
- `e2e/` test Playwright; `docs/` brief, decisioni, manuale.

## Come lavorare

- Una tappa per volta (brief, sezione 14). Prima la logica con i test, poi i componenti, poi le pagine.
- Dopo una modifica allo schema: `npm run db:generate`, poi controlla la migrazione a mano.
- A fine sessione: cosa è stato fatto; test eseguiti e risultato; decisioni e valori di partenza usati; domande aperte per il titolare; cosa serve alla prossima sessione.
- Nessun rilascio in produzione nelle fasce di gioco (19-24).
