# Schede operative OFCN

Portale web separato dal software **Automazione Ufficio Piani**.

## Stato

Step 2 completato: progetto Supabase configurato e autenticazione pubblicata e
collaudata da smartphone.

Sono previsti:

- un account condiviso per il personale;
- un account amministratore separato;
- sessioni contemporanee indipendenti;
- logout limitato al dispositivo corrente;
- nessuna anagrafica preventiva del personale.

Il form operativo e le tabelle delle risposte non sono ancora attivi.

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
```

La chiave pubblicabile Supabase presente in `config.js` è destinata al browser.
Chiavi `service_role`, `sb_secret_...`, password e credenziali personali non devono
mai essere inserite nel repository.

## Pubblicazione

GitHub Pages pubblica la radice del branch `main` tramite GitHub Actions.
