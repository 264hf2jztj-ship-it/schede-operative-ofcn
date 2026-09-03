# Step 4 — Form operativo e area amministrativa

## Stato

Versione definitiva pubblicata su GitHub Pages. La campagna 2027 è attiva
senza una data di chiusura automatica.

## Form del personale

- dati personali limitati a matricola, cognome e nome;
- selezione obbligatoria del 2° o del 50° Gruppo;
- indisponibilità multiple;
- avviso dal secondo periodo, senza bloccare quelli successivi;
- tre turni in ordine di priorità con punteggio 3–2–1;
- turni da evitare come soft constraint;
- disponibilità per Natale, Estate e doppio turno;
- corsi, estensioni di qualifica ed esercitazioni desiderate;
- note;
- PDF locale della bozza o della scheda inviata;
- invio idempotente a Supabase.

Il modulo non conserva stabilmente una bozza con dati personali nel browser.
La memoria di recupero usata durante la generazione PDF è temporanea.

## Area amministrativa

Ogni amministratore vede soltanto il proprio reparto e può:

- cercare per matricola o nominativo;
- filtrare per stato;
- aprire il dettaglio;
- aggiornare lo stato;
- scaricare il JSON originale;
- scaricare una raccolta JSON delle schede selezionate;
- vedere l'ultimo download avviato;
- eliminare definitivamente una scheda.

Prima della cancellazione viene sempre richiesta una conferma. Se la scheda non
risulta scaricata, la conferma contiene un avviso aggiuntivo.

## Procedura consigliata

Scaricare → salvare sul computer → importare nel software locale → verificare
l'importazione → eliminare da Supabase.

Il tracciamento del download è un aiuto operativo e non sostituisce il controllo
del file effettivamente salvato.
