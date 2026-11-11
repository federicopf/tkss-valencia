# Piano del progetto — TKSS Valencia

## Obiettivo

Creare il sito del gruppo Tinkus San Simón Valencia. La prima versione ha il calendario degli eventi come home page; in seguito il sito potrà ospitare altre sezioni senza dover riscrivere le fondamenta.

Il progetto deve restare semplice da usare e poco costoso da gestire. Il traffico previsto è basso.

## Decisioni già prese

| Tema | Decisione |
| --- | --- |
| Accesso pubblico | Chiunque può vedere calendario e dettagli degli eventi senza login. |
| Amministrazione | Tutti gli account autenticati sono admin nella prima versione. Non è prevista registrazione pubblica. |
| Eventi | Gli admin possono creare, modificare ed eliminare eventi. Ogni evento ha una pagina di dettaglio. |
| Tracciabilità | Le operazioni amministrative sugli eventi devono lasciare una traccia persistente. |
| Frontend | Sito statico pubblicato su Cloudflare Pages. |
| Database e login | Supabase: PostgreSQL, Auth e regole di accesso. |
| Indirizzo iniziale | Sottodominio gratuito `*.pages.dev`; un dominio proprio è opzionale. |
| Identità visiva | Logo originale del gruppo, con interfaccia prevalentemente bianca e nera. I colori restano concentrati nel logo. |
| Sequenza | Prima progetto locale e revisione; poi Supabase, repository GitHub e Cloudflare Pages. |
| Pubblicazione | Il branch principale di GitHub attiverà automaticamente la pubblicazione su Cloudflare Pages a ogni push. |

“Pubblicazione automatica” significa che Cloudflare distribuisce le modifiche dopo un push su GitHub. Il push del codice verso GitHub resta un'azione esplicita del flusso di sviluppo.

## Funzioni della prima versione

### Calendario pubblico

- Home page con calendario mensile e vista leggibile su telefono; il calendario ha anche una pagina dedicata `/calendario`.
- Navigazione tra mesi, evidenza del giorno corrente e selezione di una data.
- Elenco degli eventi per la data selezionata, con link alla pagina `/eventos/:id`.
- Ogni evento contiene almeno titolo, data/ora di inizio e fine, luogo e descrizione facoltativi.
- La pagina di dettaglio mostra tutte le informazioni e, quando presenti, una galleria di immagini.
- Stato vuoto chiaro quando non ci sono eventi; messaggio e possibilità di riprovare se il caricamento fallisce.
- Tutti gli orari degli eventi sono riferiti a `Europe/Madrid`. Il database conserva istanti con fuso orario, evitando errori con l'ora legale.

### Area admin

- Login e logout tramite Supabase Auth; account creati solo dagli amministratori del progetto.
- Creazione, modifica ed eliminazione degli eventi.
- Validazione sia nell'interfaccia sia nel database: titolo obbligatorio, fine successiva all'inizio, limiti ragionevoli per i testi.
- Le funzioni admin sono visibili solo dopo il login, ma l'autorizzazione effettiva è applicata nel database.
- Nessuna registrazione pubblica e nessuna pagina admin separata obbligatoria nella prima versione.
- Le immagini si aggiungono come file in `public/events/`, versionati con Git; nell'editor dell'evento l'admin inserisce i relativi percorsi. Il browser non carica file direttamente nel repository statico.

### Altre pagine

- `/grupo` presenta il gruppo e incorpora una mappa di Valencia tramite OpenStreetMap.
- La mappa indica la città, non un luogo di incontro specifico. Il luogo concreto resta nel singolo evento.

### Audit log

- Un trigger PostgreSQL registra ogni `INSERT`, `UPDATE` e `DELETE` sugli eventi, indipendentemente dal percorso usato per modificare i dati.
- Ogni record contiene operazione, ID dell'evento, ID dell'admin, data/ora e valori prima/dopo la modifica.
- Gli admin dell'app non possono modificare o cancellare i record dell'audit log tramite API pubblica.
- I tentativi e gli esiti di login sono consultabili nei log di Supabase Auth. Prima della pubblicazione verificheremo la loro conservazione; se serve uno storico permanente anche degli accessi, aggiungeremo un meccanismo dedicato.
- Il log non sostituisce il backup: servono entrambi.

## Architettura

```text
Visitatore o admin
       │
       ▼
Cloudflare Pages ── frontend statico (React + TypeScript)
       │
       ▼
Supabase ─────────── Auth + API + PostgreSQL
                         ├── events
                         └── admin_audit_log
```

Il browser usa soltanto la chiave pubblicabile di Supabase. Le chiavi segrete non entrano nel frontend. Le policy Row Level Security (RLS) consentono lettura pubblica degli eventi e scrittura solo agli utenti autenticati. Le regole sono versionate insieme allo schema del database e verificate con test che coprono operazioni consentite e negate.

### Organizzazione del codice

- Componenti UI separati dalla logica di caricamento e salvataggio degli eventi.
- Tipi TypeScript per dati e interfacce; tipi del database generati dallo schema quando Supabase sarà collegato.
- Configurazione tramite variabili d'ambiente, senza credenziali nel repository.
- Migrazioni SQL versionate per schema, vincoli, policy RLS e trigger di audit.
- I percorsi delle immagini sono memorizzati nell'evento e validati nel database; il trigger di audit registra anche le modifiche alla galleria.
- Test mirati a date/fusi orari, permessi RLS e flussi principali; controllo TypeScript e build in CI.

## Retrocompatibilità ed evoluzione

- Identificativi stabili per gli eventi e URL pubblici che non dipendono dalla posizione nel calendario.
- Migrazioni del database progressive; evitare rinominazioni o eliminazioni di colonne nello stesso rilascio che cambia il codice che le usa.
- Nessuna API pubblica versionata finché non esistono client esterni; quando servirà, definiremo un contratto esplicito.
- Moduli nuovi (documenti, iscrizioni, comunicazioni) potranno aggiungersi senza cambiare il modello di autorizzazione del calendario.
- Eventi ricorrenti, bozze, notifiche e caricamento di file restano fuori dalla prima versione: richiedono regole funzionali proprie.

## Infrastruttura e gestione

### Fase locale

1. Preparare progetto, calendario e interfaccia admin.
2. Scrivere schema, policy e audit log come migrazioni, senza creare ancora servizi remoti.
3. Verificare build, usabilità mobile e accessibilità di base.
4. Rivedere il risultato prima di collegare gli account esterni.

### Fase di collegamento

1. Creare il progetto Supabase e scegliere una regione europea adeguata.
2. Applicare le migrazioni e creare i primi account admin; disabilitare le iscrizioni pubbliche.
3. Creare il repository GitHub e collegare il branch principale a Cloudflare Pages.
4. Configurare URL e chiave pubblicabile per la build; configurare in Supabase gli URL consentiti per il login.
5. Pubblicare su `*.pages.dev` e provare lettura anonima, login, creazione/modifica/eliminazione e audit log.

### Operatività

- Backup periodico del database conservato fuori da Supabase, con prova di ripristino.
- Controllo degli errori di build, dell'uso delle quote e degli avvisi di Supabase.
- Aggiornamenti delle dipendenze in piccoli rilasci, con build e test prima della pubblicazione.
- Nessuna infrastruttura server da mantenere nella prima versione.

## Costi e compromessi

L'obiettivo iniziale è usare i piani gratuiti di Cloudflare Pages e Supabase. Il sottodominio `pages.dev` non richiede l'acquisto di un dominio.

Il principale limite è Supabase Free: un progetto con attività molto bassa può essere messo in pausa; in quel caso il calendario non potrà caricare gli eventi fino alla riattivazione. Il piano gratuito non offre backup automatici del database, quindi le esportazioni esterne fanno parte dell'operatività. Se il gruppo richiederà disponibilità continua, rivaluteremo il piano a pagamento o un'altra soluzione.

Le quote e le condizioni economiche vanno ricontrollate immediatamente prima dell'attivazione dei servizi.

## Criteri di completamento della prima versione

- Il sito pubblico mostra il calendario su desktop e telefono senza richiedere login.
- Home, calendario, gruppo e dettaglio evento sono raggiungibili con URL propri, anche aprendo direttamente il link.
- Un evento può mostrare immagini statiche versionate nel repository.
- Un visitatore non autenticato non può creare, modificare o eliminare eventi nemmeno chiamando direttamente l'API.
- Un admin può accedere e gestire gli eventi.
- Ogni inserimento, modifica o eliminazione genera una voce di audit con autore e timestamp.
- Le migrazioni ricreano schema e policy in un ambiente nuovo; test e build passano.
- Un push sul branch principale pubblica automaticamente il frontend su Cloudflare Pages.
- È documentato e verificato il procedimento di backup e ripristino.

## Dettagli da concordare prima della pubblicazione

- Lingua principale del sito: propongo spagnolo, dato che il gruppo è a Valencia.
- Indirizzi email dei primi admin (da inserire direttamente in Supabase, non nel repository).
- Frequenza e destinazione dei backup esterni.
