# Schede operative OFCN

Portale web separato dal software **Automazione Ufficio Piani**, pubblicato con
GitHub Pages e collegato al progetto Supabase dedicato.

## Stato

Lo sviluppo del portale pubblico e dell'area amministrativa è concluso. La
campagna annuale **2027** è attiva senza date di apertura o chiusura
automatica e resterà disponibile finché non verrà chiusa manualmente. Dopo la
pulizia conclusiva il database non contiene schede di collaudo.

## Accessi

- `PLAN_OFCN`: account condiviso del personale, utilizzabile
  contemporaneamente da più dispositivi;
- `ADMIN_2`: amministratore del 2° Gruppo;
- `ADMIN_50`: amministratore del 50° Gruppo;
- logout limitato al dispositivo corrente;
- registrazione pubblica e accessi anonimi disattivati;
- nessuna anagrafica preventiva del personale.

Supabase Auth usa internamente indirizzi email tecnici, mentre il portale mostra
soltanto i nomi utente. Le password non sono presenti nel repository.

## Scheda 2027

Il form raccoglie:

- matricola, cognome e nome;
- reparto destinatario: 2° Gruppo oppure 50° Gruppo;
- periodi di indisponibilità, con avviso al raggiungimento dei due consigliati
  ma senza bloccare periodi ulteriori;
- tre turni in ordine di priorità, con punteggio 3–2–1;
- turni da evitare preferibilmente come vincoli deboli;
- disponibilità per Natale, Estate e doppio turno;
- corsi interni o esterni alla Brigata, estensioni di qualifica ed esercitazioni
  desiderate;
- note generali.

La copia destinata al compilatore è un PDF. A Supabase viene inviato il payload
JSON versione 1, compatibile con il successivo adeguamento dell'importatore
locale.

## Area amministrativa

Ogni amministratore può operare esclusivamente sulle schede del proprio reparto:

- consultare e filtrare le risposte;
- aggiornare lo stato;
- scaricare il JSON singolo o una raccolta di schede selezionate;
- vedere data e amministratore dell'ultimo download avviato;
- eliminare definitivamente una scheda.

Se una scheda non risulta ancora scaricata, il portale mostra un avviso
aggiuntivo prima della cancellazione, senza impedirla. Il browser può certificare
soltanto l'avvio del download, non l'effettivo salvataggio del file sul computer.

## Procedura operativa

1. Scaricare le schede dall'area amministrativa del reparto.
2. Salvare i JSON sul computer e conservarne preferibilmente una seconda copia.
3. Importarli nel software locale.
4. Verificare l'importazione.
5. Eliminare da Supabase le schede già esportate e non più necessarie online.

La procedura completa è descritta in `docs/CHIUSURA_OPERATIVA.md`.

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
  CHIUSURA_OPERATIVA.md
sql/
  001_schema_sicurezza.sql
  002_reparti_formazione.sql
  003_cancellazione_risposte_amministratori.sql
  004_tracciamento_download_amministrativo.sql
```

La chiave pubblicabile Supabase presente in `config.js` è destinata al browser.
Chiavi `service_role`, `sb_secret_...`, password e credenziali personali non
devono mai essere inserite nel repository.

GitHub Pages pubblica automaticamente la radice del branch `main`.
