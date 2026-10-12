# SMG Summer Cup

Sito del torneo di calcetto serale SMG Summer Cup (Cesenatico): archivio di edizioni, risultati, classifiche,
albo d'oro e foto; sezione dedicata alla prossima edizione con iscrizioni; pannello di gestione pensato per
inserire un risultato dal telefono in tre tocchi.

- Brief di riferimento: [`docs/SMG_Summer_Cup_Brief_Tecnico.pdf`](docs/SMG_Summer_Cup_Brief_Tecnico.pdf) (v1.1)
- Scelte fatte e punti aperti: [`docs/DECISIONI.md`](docs/DECISIONI.md)
- Manuale dell'organizzatore: [`docs/MANUALE.md`](docs/MANUALE.md)
- Regole per chi sviluppa (e per Claude Code): [`CLAUDE.md`](CLAUDE.md)

## Avvio in locale

Serve Node.js 20.19 o successivo.

```bash
npm install
npm run dev
```

Apri <http://localhost:3000>. Senza `DATABASE_URL` il sito usa un PostgreSQL incorporato nella cartella
`.data/` e al primo avvio carica l'**edizione di esempio** del brief (sezione 18): 16 squadre inventate,
32 partite, rose, tabellone. Tutto ciò che viene dall'esempio porta `source = 'example'`.

Per entrare nel pannello: <http://localhost:3000/admin>, email `titolare@example.org`
(altri utenti di esempio: `staff1@example.org` Redazione, `socio@example.org` Sola lettura).
In sviluppo non parte nessuna email: il link di accesso compare a schermo.

Da **Altro > Dati di esempio** si sceglie in che momento del torneo trovarsi: iscrizioni aperte, calendario
pubblicato, serata in corso, gironi finiti, torneo concluso. È il modo più rapido per vedere come cambia la home.

## Variabili d'ambiente

Copia `.env.example` in `.env.local`. Nel repository ci sono solo nomi e valori finti.

| Variabile | A che cosa serve |
| --- | --- |
| `SITE_URL` | Indirizzo pubblico: link di accesso, anteprime social, sitemap. |
| `DATABASE_URL` | PostgreSQL in regione UE. Se manca: database incorporato (solo sviluppo). |
| `AUTH_SECRET` | Segreto per link di accesso e sessioni. Obbligatorio in produzione (almeno 16 caratteri). |
| `EMAIL_API_KEY`, `EMAIL_FROM` | Invio email con Resend. Senza chiave: `.data/outbox.log`. |
| `NOTIFY_EMAIL` | Chi riceve gli avvisi di nuova iscrizione e di richiesta di rimozione. |
| `OWNER_EMAIL` | Email del titolare per `npm run db:setup`. |
| `REVALIDATE_TOKEN` | Gettone per `/api/revalidate` e `/api/cron/retention`. |
| `MEDIA_DIR` | Cartella delle foto caricate (disco persistente, fuori dalla cartella pubblica). |

## Messa in produzione

1. Database PostgreSQL in regione UE (Supabase, Neon, Render...). Imposta `DATABASE_URL`.
2. `npm run db:migrate` applica lo schema. `npm run db:setup` crea le impostazioni e l'accesso del titolare.
3. `npm run build`, poi `npm run start`. La build non ha bisogno del database.
4. Programma una chiamata al giorno a `POST /api/cron/retention` con `Authorization: Bearer $REVALIDATE_TOKEN`
   (oppure `npm run db:retention`): cancella le iscrizioni scadute e rende anonime le persone dopo 3 anni.
5. Le foto caricate vivono in `MEDIA_DIR`: serve un disco persistente. Con un hosting senza disco va scritto
   un adattatore per un archivio oggetti (vedi `lib/media/storage.ts`).

In produzione i dati di esempio non si possono caricare. Nessun rilascio nelle fasce di gioco (19-24).

## Come è fatto

```
app/
  (public)/        sito pubblico: home, [anno] (prossima edizione), edizioni/[anno]/..., squadre, albo-doro...
  admin/           pannello di gestione (protetto, noindex)
  api/             aggiornamento live, .ics, immagini social, statistiche, ricerca, esportazioni
  media/[id]/      unico punto da cui escono foto, stemmi e loghi (controlla l'approvazione)
components/        MatchCard, MatchRail, StandingsTable, Bracket, StatusBadge, hero, cornice del sito
lib/
  standings/       calcolo della classifica e spareggi (+ test)
  bracket/         tabellone derivato dalle partite
  matches/         regole di integrità di una partita
  schedule/        generatore di gironi e tabellone
  data/            accesso al database, letture in cache, ResultsProvider, importazione CSV, conservazione
  auth/            accesso con link via email, sessioni, permessi per ruolo
  media/           caricamento immagini, archivio, regola di visibilità
  config/          regole dell'edizione e impostazioni del sito (con i valori di partenza del brief)
  tokens/          token di design (variabili CSS), caratteri
  i18n/            messages/it.json: tutte le scritte dell'interfaccia
db/
  schema/          schema Drizzle (sezione 11 del brief)
  migrations/      migrazioni versionate
  seed/            edizione di esempio (example-edition-2027.json)
e2e/               test Playwright su viewport mobile
docs/              brief, DECISIONI.md, MANUALE.md
```

### Tre idee che reggono tutto

1. **Il database è la fonte di verità** e i dati di gara entrano da un solo punto, `ResultsProvider`
   (`lib/data/results-provider.ts`): pannello, importazione CSV ed esempio passano tutti da lì. Lì stanno le
   regole (una partita finita ha entrambi i punteggi, in parità a eliminazione servono i rigori, una squadra non
   gioca due partite insieme), il numero di versione che evita le sovrascritture e il registro delle modifiche.
   Un fornitore per TuttoCampo **non va scritto** finché non esistono permesso scritto e feed ufficiale.
2. **Niente regole del torneo nel codice.** Punti, criteri di spareggio, gironi, qualificate, orari e quota
   stanno in `edition.config` e si cambiano dal pannello. La classifica si calcola dai risultati, mai si salva.
3. **Niente dati personali fuori posto.** Il sito pubblico riceve i nomi già nella forma pubblicabile
   (`publicPersonName`) e le foto solo se approvate (`isMediaPublic`).

### Cache

Le pagine si generano sul server; i dati arrivano da letture in cache per etichetta (`lib/data/queries.ts`).
Quando il pannello salva, invalida solo le etichette toccate (`lib/data/invalidate.ts`): il risultato è visibile
subito. Se il database non risponde, si serve l'ultima versione buona con «Dati aggiornati alle HH:MM».

## Test

```bash
npm test                 # Vitest: classifica (T1-T8), fuso orario (T12), nomi (T9), foto (T10), versioni (T11), seed, permessi
npm run typecheck
npm run lint
E2E_CHANNEL=chrome npm run test:e2e   # Playwright su viewport mobile, con controllo di accessibilità (axe)
```

I test d'insieme usano un PostgreSQL vero in memoria e caricano l'edizione di esempio: verificano che le
classifiche calcolate coincidano con quelle attese dal brief e che il tabellone si riempia da solo.

## Sicurezza e privacy in breve

- Content-Security-Policy con nonce, HSTS e intestazioni di sicurezza (`proxy.ts`, `next.config.ts`).
- Nessun dominio di terzi: caratteri serviti dal sito, mappe come collegamento, statistiche fatte in casa senza cookie.
- Un solo cookie, tecnico, per la sessione del pannello.
- Sicurezza per riga attiva su tutte le tabelle, senza regole pubbliche.
- Limitazione di frequenza e campo esca sui moduli pubblici.
