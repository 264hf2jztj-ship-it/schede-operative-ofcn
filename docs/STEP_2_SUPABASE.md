# Step 2 — Configurazione Supabase Auth

## Progetto

- Nome: `schede-operative-ofcn`
- Project ref: `zwevsjvvuycbkqddwiky`
- Regione: `eu-central-1` (Francoforte)
- Site URL: `https://264hf2jztj-ship-it.github.io/schede-operative-ofcn/`

## Impostazioni Auth obbligatorie

Nel pannello Supabase del progetto:

1. lasciare attivo il provider **Email**;
2. disattivare **Allow new users to sign up**;
3. lasciare disattivati gli accessi anonimi;
4. impostare la **Site URL** sull'indirizzo GitHub Pages indicato sopra;
5. aggiungere lo stesso indirizzo alle **Redirect URLs**, senza wildcard;
6. non attivare **Single session per user**;
7. mantenere l'expiry JWT predefinita.

## Account

Da **Authentication → Users** creare manualmente:

1. un account condiviso per il personale con email tecnica
   `plan-ofcn@schede-operative-ofcn.invalid`, password di almeno 12 caratteri e
   conferma automatica; il portale mostrerà il nome utente `PLAN_OFCN`;
2. un account personale separato per l'amministratore.

Per l'amministratore usare un indirizzo email realmente accessibile. L'email tecnica
dell'account condiviso non riceve messaggi e non consente il recupero autonomo della
password. Non inserire password nel repository, nei file di configurazione o nelle
conversazioni. Il ruolo amministratore verrà assegnato nel database in uno step
successivo.

## Collaudo completato

- [x] login corretto da smartphone;
- [x] persistenza della sessione dopo ricarica pagina;
- [x] logout locale;
- [x] nuovo accesso dopo il logout;
- [x] registrazioni pubbliche disattivate;
- [x] accessi anonimi disattivati;
- [ ] sessioni contemporanee su due dispositivi, da ricontrollare prima della
  distribuzione generale.
