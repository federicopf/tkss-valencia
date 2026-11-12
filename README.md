# Tinkus San Simón Valencia

Sito del gruppo con calendario pubblico e gestione degli eventi riservata agli admin. Il piano completo è in [PLAN.md](PLAN.md).

## Stato

La prima versione locale funziona con Supabase CLI: PostgreSQL, Auth e API vengono avviati in Docker, le migrazioni vengono applicate e due eventi marcati `[Demo]` vengono inseriti per il test. Nessun account cloud è necessario.

## Pagine

- `/`: home con calendario e presentazione del gruppo.
- `/calendario`: calendario dedicato.
- `/eventos/:id`: dettaglio dell'evento con eventuale galleria.
- `/grupo`: informazioni sul gruppo.

## Sviluppo locale

Richiede Node.js 20.19+, npm e Docker in WSL. Dal terminale WSL, nella cartella del progetto, usa:

```sh
./scripts/start-local.sh
```

Lo script avvia Docker tramite `sudo` solo se è fermo, installa le dipendenze se mancano, poi avvia Supabase locale e Vite. Il sito sarà su **http://localhost:5173**, Supabase Studio su **http://127.0.0.1:54323**. L'account admin di sviluppo è `admin@tkss.test` con password `TkssLocal2026!`. Sono credenziali valide soltanto per lo stack locale: non usarle nel progetto remoto.

Se Docker e le dipendenze sono già pronti, basta anche:

```sh
npm run dev:full
```

Lo script PowerShell in `scripts/start-local.ps1` resta disponibile solo come alternativa per chi avvia il progetto dal terminale Windows.

Il primo avvio scarica le immagini Docker. `dev:full` crea la rete Docker locale, applica le migrazioni quando necessario, prepara `.env.local`, crea l'admin di sviluppo e inserisce eventi di esempio se il calendario è vuoto. La rete pubblica i servizi Docker solo su `127.0.0.1` di WSL; Vite inoltra le chiamate Supabase sul proprio indirizzo per renderle raggiungibili anche dal browser Windows.

`Ctrl+C` ferma Vite. Per fermare anche Supabase: `npm run db:stop`. I dati restano disponibili al riavvio. Per cancellare i dati e riapplicare le migrazioni: `npx supabase db reset` (operazione distruttiva sul database **locale**).

Le variabili `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` vengono scritte automaticamente in `.env.local` solo per lo sviluppo. La chiave pubblicabile è pensata per il browser; non inserire mai una secret key nel frontend.

```sh
npm run build
npm run lint
npm test
npm run test:local
```

`test:local` richiede Supabase locale avviato e verifica davvero lettura pubblica, scrittura anonima negata, operazioni admin e audit log.

## Immagini degli eventi

Metti i file in `public/events/`, per esempio `public/events/ensayo-noviembre/foto-01.webp`, e aggiungili a Git. Dopo che il sito serve il file, inserisci nell'editor dell'evento il percorso `/events/ensayo-noviembre/foto-01.webp`, una riga per immagine. L'editor verifica che il file esista prima di salvare. Sono ammessi JPG, PNG, WebP e AVIF, fino a 12 immagini per evento.

In produzione pubblica prima i nuovi file con un push su GitHub e attendi il deploy Cloudflare; poi collega i percorsi all'evento. Usa nomi stabili: rimuovere o rinominare un file già usato romperebbe la galleria finché non aggiorni l'evento. Il database salva i percorsi, mentre Git conserva le versioni dei file. Il file `public/events/demo/logo-grupo.png` è solo un esempio locale.

## Pubblicazione su Cloudflare Pages

Il deploy del frontend è automatico tramite Git integration di Cloudflare Pages. Un push su `main` pubblica la produzione; i branch e le pull request generano anteprime. La workflow GitHub `Checks` esegue lint, test e build su ogni push e pull request.

In Cloudflare vai su **Workers & Pages → Create application → Pages → Connect to Git**, autorizza GitHub e seleziona `federicopf/tkss-valencia`. Usa queste impostazioni:

- Production branch: `main`
- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: lascia vuoto (radice del repository)

Prima di attivare la connessione configura le variabili di build `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` per Production. Dopo aver creato Supabase, inserisci i valori di produzione in **Settings → Environment variables** del progetto Pages. Non usare la secret/service-role key nel frontend.

Per fare in modo che la produzione riceva solo codice verificato, imposta in GitHub una ruleset per `main` che richieda una pull request e il job `frontend` della workflow `Checks` prima del merge. Senza questa protezione, un push diretto a `main` avvia comunque un deploy Cloudflare.

Le migrazioni Supabase restano separate e manuali: crea prima il progetto di produzione, configura i secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` e `SUPABASE_DB_PASSWORD` nell'ambiente GitHub `production`, poi avvia **Actions → Apply Supabase migrations** dal branch `main`. Questa workflow applica solo le migrazioni versionate e non importa dati demo.

## Collegamento di Supabase

1. Creare un progetto Supabase in una regione europea.
2. Applicare le migrazioni in `supabase/migrations` tramite Supabase CLI.
3. Disabilitare `Allow new users to sign up` in Supabase Auth.
4. Creare o invitare manualmente gli account admin.
5. Configurare gli URL di redirect per il sito Cloudflare Pages e per lo sviluppo locale.
6. Inserire URL e chiave pubblicabile in `.env.local` o nelle variabili di build di Cloudflare Pages.
7. Provare lettura anonima, gestione degli eventi e audit log prima della pubblicazione.

Le migrazioni sono la fonte di verità per schema, permessi e audit. Dopo il collegamento, modificare il database tramite nuove migrazioni versionate.

## Sicurezza e audit

La tabella `events` è leggibile da chiunque. Solo gli utenti autenticati possono scrivere; nella prima versione ogni account autenticato è admin. Il database limita le colonne modificabili e registra inserimenti, modifiche ed eliminazioni in `admin_audit_log` con un trigger. La tabella di audit non è accessibile tramite le chiavi client.

I log di login appartengono a Supabase Auth. La loro conservazione va verificata prima della pubblicazione; se serve uno storico permanente degli accessi, va aggiunto un flusso dedicato.

## Pubblicazione prevista

Il deploy frontend su Cloudflare Pages parte automaticamente dai push al branch `main`, protetto dai controlli CI. Le migrazioni al database di produzione si applicano separatamente tramite workflow manuale. Hosting e database di produzione restano distinti dallo stack locale.
