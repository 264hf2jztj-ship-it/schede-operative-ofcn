# Step 4 — Form operativo

## Stato

Pubblicato e in collaudo. La campagna 2027 è aperta temporaneamente per sette
giorni a partire dal 31 agosto 2026. In questa fase devono essere usati soltanto
dati fittizi.

## Funzioni disponibili

- caricamento della campagna aperta dopo il login;
- matricola, cognome, nome, esperienza e ruolo OFCN;
- scadenze operative;
- più periodi di indisponibilità;
- più corsi o esercitazioni con buffer;
- turni e periodi preferiti o da evitare;
- disponibilità Natale ed Estate;
- note;
- download della bozza JSON;
- invio a Supabase con pulsante bloccato durante la richiesta;
- download della copia congelata dopo l'invio;
- possibilità di inviare intenzionalmente una nuova versione.

Il modulo non salva una bozza con dati personali in `localStorage`. I dati
restano nella memoria della pagina fino a invio, aggiornamento o chiusura.

## Payload

La funzione `buildPayload()` alimenta sia il download sia l'invio. Il formato è
`schede_operative_ofcn`, versione 1, con un solo anno e una sola matricola. Il
campo `storageKey` coincide con quello usato dall'importatore locale:
`aup_pianificazione_ofcn_scadenze_operative_v1`.

## Collaudo richiesto

1. accedere con `PLAN_OFCN`;
2. verificare che compaia la campagna 2027;
3. usare matricola e nominativo fittizi;
4. aggiungere e rimuovere un'indisponibilità;
5. aggiungere e rimuovere un corso;
6. scaricare la bozza JSON;
7. inviare una scheda di prova;
8. scaricare la copia inviata.

Dopo il collaudo, la risposta fittizia verrà eliminata e la campagna verrà
richiusa prima degli sviluppi successivi.
