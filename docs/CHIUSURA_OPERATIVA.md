# Chiusura operativa — Portale schede OFCN 2027

## Stato conclusivo

- portale pubblico protetto e pubblicato;
- account condiviso `PLAN_OFCN`;
- amministratori separati `ADMIN_2` e `ADMIN_50`;
- instradamento e RLS separati per reparto;
- campagna 2027 attiva senza date automatiche;
- database ripulito dalle schede di collaudo;
- download PDF per il compilatore;
- download JSON singolo e multiplo per l'amministratore;
- tracciamento dell'ultimo download avviato;
- avviso prima di eliminare schede non scaricate;
- cancellazione definitiva disponibile al solo amministratore del reparto.

## Procedura nel periodo di raccolta

1. Il personale accede con `PLAN_OFCN`, compila e invia.
2. L'amministratore accede con l'account del proprio reparto.
3. Seleziona e scarica le schede.
4. Controlla che il file JSON sia presente sul computer.
5. Conserva preferibilmente una seconda copia.
6. Importa le schede nel software locale.
7. Verifica il risultato dell'importazione.
8. Elimina dal portale le schede già acquisite.

## Significato del tracciamento

`scaricato_il` indica che il download è stato avviato dal portale.
`scaricato_da` identifica l'amministratore autenticato. Il browser non comunica
al portale se l'utente ha annullato la finestra di salvataggio, spostato o
successivamente cancellato il file.

Per questo motivo l'avviso di cancellazione è intenzionalmente non bloccante:
la decisione finale resta all'amministratore.

## Controlli prima della distribuzione generale

- verificare l'accesso dei tre account;
- verificare che i due amministratori vedano soltanto il proprio reparto;
- effettuare un invio fittizio per reparto;
- provare download singolo e multiplo;
- verificare la comparsa della data di download;
- provare l'avviso di cancellazione su una scheda non scaricata;
- eliminare tutte le nuove schede di prova;
- confermare che le password siano state distribuite tramite un canale sicuro.
