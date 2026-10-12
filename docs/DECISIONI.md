# Decisioni di progetto

Registro delle scelte fatte durante lo sviluppo, come chiesto dal brief (16.1): per ogni punto
**da verificare** o **da decidere** si usa il valore di partenza, lo si rende configurabile e lo si annota qui.
Chi sviluppa non ha parlato con il titolare: nulla di ciò che segue è un fatto del torneo.

Ultimo aggiornamento: 12 ottobre 2026 (brief v1.1).

## 1. Valori di partenza del brief (sezione 15) e dove si cambiano

| # | Punto aperto | Valore usato | Dove si cambia |
| --- | --- | --- | --- |
| 1 | Date e luogo 2027 | «Date in arrivo» se l'edizione non ha date; luogo dal database | Pannello > Edizioni |
| 2 | Squadre, gironi, qualificate | 4 gironi, 2 qualificate, poi eliminazione diretta | Pannello > Edizioni > Regole |
| 3 | Coppa e Supercoppa | Coppa = gironi + eliminazione; Supercoppa = partita unica | Struttura dell'edizione (competizioni e fasi) |
| 4 | Punti e spareggi | 3/1/0; scontri diretti (punti, differenza reti), differenza reti, gol fatti, fair play, sorteggio | Pannello > Edizioni > Regole |
| 5 | Campi e orari | 1 campo; 20:00, 20:45, 21:30, 22:15; 45 minuti per partita | Pannello > Edizioni > Formula |
| 6 | Categorie | Una sola | - |
| 7 | Quota | Testo libero (importo e come si paga); nessun pagamento online | Pannello > Edizioni > Iscrizioni |
| 8 | Regolamento | Pagina vuota con avviso finché il titolare non lo scrive | Pannello > Regolamento e testi |
| 9-10 | TuttoCampo | Strada 2: fonte unica nostra. Solo un collegamento «Vedi su TuttoCampo» | Pannello > Edizioni (collegamento) |
| 11 | Edizioni passate | Albo d'oro compilabile a mano per le edizioni di cui si sa solo il vincitore | Pannello > Albo d'oro |
| 12 | Dati rilevati | Solo punteggio obbligatorio; marcatori, cartellini e MVP facoltativi | Scheda partita nel pannello |
| 13 | Chi inserisce | Titolare + Redazione + Sola lettura | Pannello > Utenti |
| 14 | Logo | PNG ricevuto (vedi 3.1) | `public/brand/logo-smg.png` + `npm run assets:icons` |
| 15 | Stemmi | Cerchio nel colore della maglia con la sigla | Pannello > Squadre |
| 16 | Sponsor | Tutti allo stesso livello (campo «fascia» pronto) | Pannello > Sponsor |
| 17 | Tema | Chiaro | `lib/tokens/tokens.css` |
| 18 | Numeri di telefono | **Non pubblicati finché non vengono inseriti dal pannello** (vedi 2.1) | Pannello > Impostazioni |
| 19 | Titolare del trattamento | Campo vuoto: le pagine legali dicono «in via di definizione» | Pannello > Impostazioni |
| 20 | Liberatorie | Nessuna foto o nome di minorenne senza consenso registrato | Pannello > Squadre, Foto |
| 21 | Rimozioni | Modulo pubblico + elenco nel pannello con scadenza a 72 ore | Pannello > Richieste di rimozione |
| 22-24 | Dominio, costi, accordo | Non toccati: restano al titolare | - |

A tavolino (T8, da verificare): 3-0, i gol contano per la classifica ma non per i marcatori. Si cambia in `edition.config.forfeit`.

## 2. Scelte che toccano privacy e minorenni

Il brief chiede di fermarsi e chiedere quando una scelta tocca questi temi. Il committente ha chiesto di
procedere con lo sviluppo: in ogni caso dubbio è stata presa l'opzione più prudente e reversibile, elencata qui
perché venga confermata o cambiata.

1. **Numeri di telefono fuori dal repository.** Il valore di partenza del brief è «pubblicarli» (sono già nella bio),
   ma lo stesso brief vieta dati personali nel repository. I numeri non sono scritti da nessuna parte nel codice:
   si inseriscono da Pannello > Impostazioni e compaiono nella pagina Info solo da quel momento.
2. **Nomi.** Una sola funzione decide come compare una persona (`publicPersonName`): minorenne con liberatoria
   «Nome C.»; minorenne senza liberatoria solo «Giocatore n. X»; maggiorenne nome completo, salvo richiesta di
   non comparire. I dati che arrivano al sito pubblico (e alla cache) contengono già solo la forma pubblicabile.
3. **Foto.** Restano in bozza finché qualcuno (Titolare o Redazione) non le approva. Con «minorenni riconoscibili»
   e senza «liberatorie raccolte» l'approvazione è bloccata dal server. Una foto non pubblica risponde 404 anche
   con il link diretto. Le versioni pubblicate non contengono i metadati della fotocamera (posizione compresa).
4. **Modulo di iscrizione.** Non raccoglie dati di minorenni: chiede solo se in squadra ce ne sono e spiega che
   la liberatoria arriva dopo. Il modulo PDF della liberatoria è un collegamento configurabile (Impostazioni).
5. **Rimozione.** La richiesta arriva nel pannello con la scadenza delle 72 ore e un avviso via email. Riportare in
   bozza la foto o nascondere il nome resta un gesto di una persona: non c'è rimozione automatica.
6. **Registro delle modifiche.** Per persone, iscrizioni e impostazioni registra che cosa è cambiato (stato,
   consenso, forma del nome), non i dati personali.
7. **Conservazione** (proposte del brief, 13.9): iscrizioni cancellate 12 mesi dopo la fine dell'edizione; persone
   rese anonime dopo 3 anni; registro e statistiche 24 mesi. La pulizia va programmata una volta al giorno
   (`npm run db:retention` oppure `POST /api/cron/retention`).
8. **Pagine legali.** Sono un modello. Finché in Impostazioni non si spunta «verificate da un consulente»,
   mostrano la dicitura «testo modello in attesa di verifica».
9. **Statistiche di visita.** Fatte in casa, senza cookie e senza servizi di terzi: solo contatori giornalieri
   (evento, pagina, provenienza). Chi ha attivo «Do Not Track» o «Global Privacy Control» non viene contato.

## 3. Marchio e grafica

1. **Logo.** Si usa il PNG incorporato nel brief (700 x 700 px, fondo celeste pieno). Non è stato ridisegnato né
   ricolorato: solo ridimensionato. Le icone «mascherabili» hanno area di rispetto aggiunta intorno. Serve il file
   vettoriale o un PNG ad alta risoluzione con sfondo trasparente.
2. **Linea d'orizzonte** (proposta 4.6): tratto semplice con grattacielo, vele, ponte e faro, usato come divisore.
   Non è un ridisegno del logo e va approvato dal titolare. È un solo componente (`components/skyline.tsx`).
3. **Hero senza fotografie.** Non esistono foto con consenso registrato: l'apertura della home è grafica (celeste,
   luci dei riflettori, linea d'orizzonte). Quando ci saranno foto approvate si potrà aggiungere l'immagine.
4. **Trattamento foto** (proposta): velo celeste uniforme sulle miniature della galleria.
5. **Tre colori soltanto.** Stati, avvisi e cartellini si distinguono con testo, icona e forma, non con rosso,
   giallo o verde: il giallo non fa parte della palette e l'informazione non deve dipendere dal colore.
6. **Niente UEFA / Serie A.** Dei riferimenti è stata presa solo l'impaginazione (fascia di schede, logo al centro,
   striscia partite, hero + classifica, cerchi). Icone generiche (Lucide, licenza ISC), caratteri Barlow Condensed
   e Inter (licenza OFL) serviti dal nostro dominio.

## 4. Scelte tecniche e scostamenti dalla proposta del brief

1. **Pagine generate a ogni richiesta, dati in cache per etichetta.** Il brief propone pagine rigenerate a richiesta
   e cache sulla rete. Qui le pagine si generano sul server a ogni richiesta leggendo dati già in cache
   (`edition-{anno}`, `standings-{anno}`, `match-{id}`, `home`, `hall-of-fame`, `media-{anno}`), invalidati dal
   pannello al salvataggio. Motivi: la Content-Security-Policy usa un nonce per richiesta; un risultato salvato è
   visibile subito (non «entro 60 secondi»); la build non ha bisogno del database. Se servirà la cache sulla rete,
   si toglie il nonce e si passa a pagine statiche rigenerate per etichetta senza toccare componenti e dati.
2. **Modalità degradata.** Se il database non risponde, le letture servono l'ultima versione buona tenuta in
   memoria, e la pagina dice «Dati aggiornati alle HH:MM». Vale finché il processo resta acceso.
3. **Database.** PostgreSQL con Drizzle. In locale, senza `DATABASE_URL`, parte un PostgreSQL incorporato
   (PGlite) nella cartella `.data/`: stesso dialetto, stesse migrazioni, nessuna installazione. Non va usato in
   produzione. Sicurezza per riga attiva su tutte le tabelle e nessuna regola pubblica: legge e scrive solo il server.
4. **Classifica calcolata nell'applicazione**, non in una vista SQL: gli spareggi a sottogruppi non si esprimono
   bene in SQL e così si provano con i test. Resta vero ciò che conta: non è mai salvata né inserita a mano.
5. **Accesso al pannello** con link via email fatto in casa (gettoni monouso da 15 minuti, sessioni da 14 giorni,
   solo impronte nel database). **Non ci sono** passkey né secondo fattore per il titolare (proposta del brief).
6. **Email** con Resend (`EMAIL_API_KEY`). Senza chiave i messaggi finiscono in `.data/outbox.log`; in sviluppo
   il link di accesso compare a schermo.
7. **File caricati** su disco (`MEDIA_DIR`), serviti solo da `/media/[id]`. Per un hosting senza disco persistente
   serve un adattatore per un archivio oggetti in UE (tre funzioni in `lib/media/storage.ts`). `STORAGE_BUCKET`
   e `ANALYTICS_DOMAIN` del brief non sono usati.
8. **Limitazione di frequenza** in memoria: va bene per un solo server.
9. **PWA.** Le pagine vanno prima in rete e, se la rete non risponde entro 3,5 secondi, mostrano l'ultima copia
   salvata (che riporta l'ora dei dati). Il brief proponeva «prima la copia, poi l'aggiornamento»: scartato perché
   mostrerebbe per un attimo un risultato vecchio come se fosse nuovo.
10. **Aggiornamenti live.** Il browser controlla ogni 30 secondi se c'è una partita in corso, ogni 60 nelle serate
    di gioco, mai negli altri giorni; solo a pagina visibile.
11. **Componenti scritti a mano** (niente libreria di componenti): per restare nel budget di JavaScript della home.
12. **Indirizzo /2027.** È una pagina dinamica (`/[anno]`): vale per ogni edizione non ancora iniziata, senza
    scrivere l'anno nel codice. A torneo iniziato rimanda a `/edizioni/[anno]`.
13. **Criteri di spareggio.** I punti restano sempre il primo criterio; nel pannello si ordina il resto.
14. **Generatore di calendario** (proposta): gironi all'italiana di sola andata; tabellone automatico con 2
    qualificate per girone (A1-B2, B1-A2...) o con una qualificata per girone. Negli altri casi crea solo i gironi.

## 5. Edizione di esempio (sezione 18): incongruenze trovate nel brief

- **Recupero di VEB-SAL.** L'esempio dice «si gioca domani alle 20:00», ma alle 20:00 del giorno dopo il campo
  (unico) ospita FAR-SCO. Nel seed il recupero è alle 19:15.
- **Miglior difesa dei gironi.** Il brief cita solo Bagni Atletico (1 gol subito), ma anche Porto Canale ne ha
  subito uno: il sito le mostra entrambe.
- **Partita a tavolino.** Il brief non dice quale: nel seed è COR-ORM 3-0, l'unico 3-0 dei gironi.
- **Squadra dal nome molto lungo.** I 16 nomi sono fissati dal brief: il nome lungo è nella lista d'attesa.
- **Rose.** Il brief dà solo la rosa di Faro Rovers e cinque capocannonieri: gli altri 150 nomi sono generati in
  modo ripetibile; 36 minorenni, di cui 7 senza liberatoria; 7 maggiorenni che non vogliono comparire.
- **Scenari.** L'esempio si può caricare in cinque momenti (iscrizioni, programma, serata in corso, gironi
  finiti, torneo concluso). Negli scenari «in corso» le date sono spostate a oggi.

## 6. Che cosa manca (non fatto in questa sessione)

- Prove su telefoni veri (iOS e Android), prova con lettore di schermo, Lighthouse, prova di carico.
- Monitor di disponibilità, tracciamento errori, backup con prova di ripristino: dipendono dall'hosting scelto.
- Passkey e secondo fattore; adattatore per archivio oggetti; tema scuro attivo.
- Verifica legale di informativa, cookie e liberatoria.
- Stemmi delle squadre nelle immagini condivise (oggi c'è il cerchio con la sigla).

## 7. Domande aperte per il titolare

Restano tutte quelle della sezione 15 del brief. In più:

1. Conferma la pubblicazione dei due numeri di telefono sul sito? (oggi non compaiono)
2. Approva la linea d'orizzonte usata come divisore?
3. Può fornire il logo vettoriale e almeno una foto di ambiente senza volti per la home?
4. Quali sponsor reali, con quali loghi e collegamenti? (nel sito ci sono solo i cinque inventati del brief)
5. Chi programma la pulizia giornaliera dei dati e chi riceve gli avvisi (`NOTIFY_EMAIL`)?
