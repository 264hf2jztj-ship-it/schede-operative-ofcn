# Schede operative OFCN

Portale web separato dal software **Automazione Ufficio Piani**.

## Stato

Step 3 completato: autenticazione, schema Supabase, validazione server-side,
privilegi minimi e Row Level Security sono attivi e collaudati.

Sono previsti:

- un account condiviso per il personale;
- un account amministratore separato;
- sessioni contemporanee indipendenti;
- logout limitato al dispositivo corrente;
- nessuna anagrafica preventiva del personale.

Il form operativo non è ancora attivo. Le tabelle sono pronte, ma non è stata
ancora aperta alcuna campagna reale e non sono presenti risposte.

Collaudi superati: login `PLAN_OFCN`, persistenza della sessione, logout locale e
nuovo accesso.

Il personale accederà con il nome utente `PLAN_OFCN`. Il frontend lo associa
all'identificativo email tecnico richiesto internamente da Supabase Auth.

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
sql/
  001_schema_sicurezza.sql
```

La chiave pubblicabile Supabase presente in `config.js` è destinata al browser.
Chiavi `service_role`, `sb_secret_...`, password e credenziali personali non devono
mai essere inserite nel repository.

## Pubblicazione

GitHub Pages pubblica la radice del branch `main` tramite GitHub Actions.
