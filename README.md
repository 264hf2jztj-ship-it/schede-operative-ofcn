# Schede operative OFCN

Portale web separato dal software **Automazione Ufficio Piani**.

## Stato

Step 2 in corso: progetto Supabase creato e frontend di autenticazione predisposto.

Sono previsti:

- un account condiviso per il personale;
- un account amministratore separato;
- sessioni contemporanee indipendenti;
- logout limitato al dispositivo corrente;
- nessuna anagrafica preventiva del personale.

Il form operativo e le tabelle delle risposte non sono ancora attivi.

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
```

La chiave pubblicabile Supabase presente in `config.js` è destinata al browser.
Chiavi `service_role`, `sb_secret_...`, password e credenziali personali non devono
mai essere inserite nel repository.

## Pubblicazione

GitHub Pages pubblica la radice del branch `main` tramite GitHub Actions.
