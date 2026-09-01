# Schede operative OFCN

Portale web separato dal software **Automazione Ufficio Piani**.

## Stato

Step 3 completato. Il form operativo collegato a Supabase è pubblicato ed è in
collaudo con la campagna 2027 temporaneamente aperta.

Sono previsti:

- un account condiviso per il personale;
- due account amministratore separati, uno per ciascun reparto;
- sessioni contemporanee indipendenti;
- logout limitato al dispositivo corrente;
- nessuna anagrafica preventiva del personale.

Il form genera un JSON importabile dal software locale, invia una copia
immutabile a Supabase e permette al compilatore di scaricare una copia PDF.
Raccoglie soltanto matricola, cognome, nome, indisponibilità, tre priorità con
punteggio 3–2–1, turni da evitare come vincoli deboli, disponibilità per Natale
ed Estate, disponibilità al doppio turno e note. Per il collaudo vanno utilizzati
esclusivamente dati fittizi.

La scheda raccoglie inoltre corsi, estensioni di qualifica ed esercitazioni
desiderate. La scelta obbligatoria tra 2° Gruppo e 50° Gruppo instrada ogni
risposta verso una coda amministrativa separata e protetta.

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
