# Step 3 — Database e sicurezza

## Stato

Schema applicato al progetto Supabase `zwevsjvvuycbkqddwiky`. Dopo la pulizia
conclusiva il database contiene zero risposte di collaudo.

## Tabelle

- `public.campagne`: anno e finestra temporale della compilazione;
- `public.risposte`: payload JSON, stato, timestamp server, reparto e
  tracciamento del download;
- `public.amministratori`: UUID amministrativo e reparto autorizzato;
- `private.account_personale_condiviso`: UUID dell'account `PLAN_OFCN`.

RLS è attiva su tutte le tabelle. La tabella privata non ha policy client:
il comportamento deny-all è intenzionale.

## Campagna 2027

La campagna è configurata con:

- anno: 2027;
- flag `aperta` attivo;
- nessuna data di apertura;
- nessuna data di chiusura automatica;
- versione payload: 1.

Resterà compilabile finché il flag `aperta` non verrà disattivato manualmente.

## Permessi effettivi

| Operazione | Non autenticato | PLAN_OFCN | Admin proprio reparto |
|---|---:|---:|---:|
| Leggere la campagna aperta | No | Sì | Sì |
| Inserire una risposta | No | Sì | No |
| Leggere risposte | No | No | Sì |
| Modificare il payload | No | No | No |
| Cambiare stato | No | No | Sì |
| Registrare un download | No | No | Sì |
| Eliminare una risposta | No | No | Sì |

Gli amministratori vedono, aggiornano, scaricano ed eliminano solamente le
schede del reparto assegnato.

## Tracciamento download

Le colonne `scaricato_il` e `scaricato_da` vengono valorizzate dal database
quando l'amministratore avvia un download singolo o multiplo. Un trigger forza
il timestamp server e l'UUID autenticato: il frontend non può attribuire il
download a un altro utente.

Il tracciamento certifica l'avvio del download dal portale. Non può certificare
che il browser abbia completato il salvataggio o che il file sia stato
successivamente conservato.

## Contratto JSON

Ogni invio contiene un solo anno e una sola scheda, con:

- `tipoFile: "schede_operative_ofcn"`;
- `versione: 1`;
- `annoCorrente: 2027`;
- reparto coerente tra payload e scheda;
- identità coerente tra chiave e contenuto;
- tre priorità distinte con punteggio 3–2–1;
- disponibilità valide;
- payload massimo 256 KiB.

Il numero di periodi di indisponibilità non è limitato dal database.

## Script riproducibili

- `sql/001_schema_sicurezza.sql`;
- `sql/002_reparti_formazione.sql`;
- `sql/003_cancellazione_risposte_amministratori.sql`;
- `sql/004_tracciamento_download_amministrativo.sql`.
