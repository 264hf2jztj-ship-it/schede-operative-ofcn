# Schede operative OFCN

Portale web separato dal software **Automazione Ufficio Piani**.

## Stato

Il form operativo e l'area amministrativa collegati a Supabase sono pubblicati
e in collaudo con la campagna 2027 temporaneamente aperta.

Sono previsti:

- un account condiviso per il personale;
- due account amministratore separati, uno per ciascun reparto;
- sessioni contemporanee indipendenti;
- logout limitato al dispositivo corrente;
- nessuna anagrafica preventiva del personale.

Il form genera un JSON importabile dal software locale, invia una copia
immutabile a Supabase e permette al compilatore di scaricare una copia PDF.
Raccoglie soltanto matricola, cognome, nome, un massimo di due periodi di indisponibilità, tre priorità con
punteggio 3–2–1, turni da evitare come vincoli deboli, disponibilità per Natale
ed Estate, disponibilità al doppio turno e note. Per il collaudo vanno utilizzati
esclusivamente dati fittizi.

La scheda raccoglie inoltre corsi, estensioni di qualifica ed esercitazioni
desiderate. La scelta obbligatoria tra 2° Gruppo e 50° Gruppo instrada ogni
risposta verso una coda amministrativa separata e protetta.

Collaudi superati: login `PLAN_OFCN`, persistenza della sessione, logout locale,
nuovo accesso e instradamento separato delle risposte.

Il personale accederà con il nome utente `PLAN_OFCN`. Il frontend lo associa
all'identificativo email tecnico richiesto internamente da Supabase Auth.

Gli amministratori accedono con `ADMIN_2` e `ADMIN_50`. Il ruolo effettivo viene
letto dalla tabella protetta `amministratori`: il nome utente nel frontend non
attribuisce permessi. Ogni amministratore vede solo la coda del proprio reparto,
può aprire il dettaglio, aggiornare lo stato e scaricare il JSON originale di una
scheda oppure una raccolta JSON delle schede selezionate. Può inoltre eliminare
definitivamente una scheda inviata per errore, dopo una conferma esplicita; la
policy RLS limita la cancellazione alle sole schede del proprio reparto.

Il formato della raccolta amministrativa è `raccolta_schede_operative_ofcn`
versione 1. Ogni elemento contiene metadati di ricezione e il `payload` originale
inviato dal compilatore.

## Struttura

```text
index.html
assets/
  css/app.css
  js/
    app.js
    config.js
docs/
  STEP_2_SUPABASE.md
  STEP_3_DATABASE.md
  STEP_4_FORM.md
sql/
  001_schema_sicurezza.sql
  002_reparti_formazione.sql
```

La chiave pubblicabile Supabase presente in `config.js` è destinata al browser.
Chiavi `service_role`, `sb_secret_...`, password e credenziali personali non devono
mai essere inserite nel repository.

## Pubblicazione

GitHub Pages pubblica la radice del branch `main` tramite GitHub Actions.
