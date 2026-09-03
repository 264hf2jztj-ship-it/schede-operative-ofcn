# Step 2 — Configurazione Supabase Auth

## Progetto

- Nome: `schede-operative-ofcn`
- Project ref: `zwevsjvvuycbkqddwiky`
- Regione: `eu-central-1` (Francoforte)
- Site URL: `https://264hf2jztj-ship-it.github.io/schede-operative-ofcn/`

## Configurazione

- provider Email attivo, usato internamente con indirizzi tecnici;
- registrazione pubblica disattivata;
- accessi anonimi disattivati;
- Site URL e Redirect URL impostati sull'indirizzo GitHub Pages;
- `Single session per user` disattivata;
- logout applicativo con scope locale.

Il portale espone nomi utente e li associa localmente agli identificativi email
tecnici richiesti da Supabase Auth:

- `PLAN_OFCN`: account condiviso del personale;
- `ADMIN_2`: amministratore del 2° Gruppo;
- `ADMIN_50`: amministratore del 50° Gruppo.

I nomi utente non attribuiscono permessi. I ruoli amministrativi effettivi e il
reparto autorizzato sono stabiliti dalla tabella protetta
`public.amministratori`.

## Collaudi completati

- [x] login da smartphone;
- [x] persistenza della sessione dopo la ricarica;
- [x] logout del solo dispositivo corrente;
- [x] nuovo accesso dopo il logout;
- [x] sessioni contemporanee;
- [x] account amministrativi separati per reparto;
- [x] registrazioni pubbliche disattivate;
- [x] accessi anonimi disattivati.

Le password non devono essere inserite nel repository, nei file di
configurazione o nelle conversazioni.
