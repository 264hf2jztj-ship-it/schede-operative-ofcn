# Step 3 — Database e sicurezza

## Stato

Completato e applicato al progetto Supabase `zwevsjvvuycbkqddwiky`.

Non sono state inserite campagne reali, risposte di produzione o anagrafiche
del personale.

## Tabelle

- `public.campagne`: anni disponibili e finestre di apertura;
- `public.risposte`: invii immutabili, payload JSON, stato e timestamp server;
- `public.amministratori`: account autorizzati alla gestione;
- `private.account_personale_condiviso`: UUID dell'account comune `PLAN_OFCN`.

La tabella privata ha RLS attiva e nessuna policy client: il comportamento
deny-all è intenzionale. Le funzioni interne autorizzate la consultano con
`SECURITY DEFINER`, `search_path` vuoto e controllo esplicito di `auth.uid()`.

## Contratto JSON

Il database accetta lo stesso formato già importabile dal software locale:

```json
{
  "tipoFile": "schede_operative_ofcn",
  "versione": 1,
  "annoCorrente": 2027,
  "schedeOperative": {
    "2027": {
      "MATRICOLA": {
        "matricola": "MATRICOLA",
        "nominativo": "COGNOME NOME",
        "anno": 2027
      }
    }
  }
}
```

Ogni invio deve contenere un solo anno e una sola scheda. Matricola e anno
devono coincidere tra chiavi e contenuto. Il limite del payload è 256 KiB.

## Permessi effettivi

| Operazione | Non autenticato | Account condiviso | Amministratore |
|---|---:|---:|---:|
| Leggere campagne aperte | No | Sì | Sì |
| Inserire una risposta | No | Sì | No |
| Leggere risposte | No | No | Sì |
| Modificare il payload | No | No | No |
| Cambiare stato | No | No | Sì |
| Cancellare risposte | No | No | No |

Gli amministratori possono aggiornare soltanto la colonna `stato`; timestamp e
UUID di elaborazione vengono determinati dal database.

## Controlli superati

- invio valido dell'account condiviso;
- impossibilità per il personale di leggere le risposte;
- rifiuto di un payload alterato;
- idempotenza tramite `submission_id` univoco;
- lettura amministrativa;
- cambio stato amministrativo con audit server-side;
- nessun dato di prova persistito;
- nessun privilegio `anon` sulle risposte;
- payload non aggiornabile dal ruolo `authenticated`;
- RLS attiva su tutte le tabelle pubbliche e sulla tabella privata.

Gli advisor prestazioni indicano gli indici come non usati perché le tabelle
sono ancora vuote. L'avviso Auth relativo alle password compromesse dipende
dalla funzione `Leaked Password Protection`, disponibile sui piani Supabase che
la includono.

## Script riproducibile

Lo schema completo è in `sql/001_schema_sicurezza.sql`. Non contiene password,
secret key o dati personali.
