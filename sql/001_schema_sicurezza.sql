-- Step 3 - Schema e sicurezza del portale Schede operative OFCN
-- Progetto Supabase: zwevsjvvuycbkqddwiky

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create table private.account_personale_condiviso (
    user_id uuid primary key references auth.users (id) on delete cascade,
    creato_il timestamptz not null default now()
);

revoke all on table private.account_personale_condiviso from public, anon, authenticated;
grant select, insert, update, delete on table private.account_personale_condiviso to service_role;

do $$
declare
    account_count integer;
begin
    select count(*)
      into account_count
      from auth.users
     where lower(email) = 'plan-ofcn@schede-operative-ofcn.invalid';

    if account_count <> 1 then
        raise exception 'Account condiviso PLAN_OFCN non trovato oppure non univoco';
    end if;

    insert into private.account_personale_condiviso (user_id)
    select id
      from auth.users
     where lower(email) = 'plan-ofcn@schede-operative-ofcn.invalid'
    on conflict (user_id) do nothing;
end;
$$;

create table public.campagne (
    anno smallint primary key check (anno between 2020 and 2100),
    aperta boolean not null default false,
    apertura_il timestamptz,
    chiusura_il timestamptz,
    versione_payload smallint not null default 1 check (versione_payload = 1),
    creato_il timestamptz not null default now(),
    aggiornato_il timestamptz not null default now(),
    constraint campagne_intervallo_valido check (
        apertura_il is null
        or chiusura_il is null
        or apertura_il < chiusura_il
    )
);

create table public.amministratori (
    user_id uuid primary key references auth.users (id) on delete cascade,
    creato_il timestamptz not null default now()
);

create table public.risposte (
    id bigint generated always as identity primary key,
    submission_id uuid not null unique,
    inviato_da uuid not null default auth.uid() references auth.users (id),
    anno smallint not null references public.campagne (anno),
    risposta_json jsonb not null,
    stato text not null default 'nuova'
        check (stato in ('nuova', 'elaborata', 'archiviata')),
    ricevuto_il timestamptz not null default clock_timestamp(),
    elaborato_il timestamptz,
    elaborato_da uuid references auth.users (id) on delete set null,
    constraint risposte_elaborazione_coerente check (
        (stato = 'nuova' and elaborato_il is null and elaborato_da is null)
        or
        (stato in ('elaborata', 'archiviata') and elaborato_il is not null and elaborato_da is not null)
    )
);

create unique index campagne_una_sola_aperta_idx
    on public.campagne (aperta)
    where aperta;

create index risposte_anno_stato_ricevuto_idx
    on public.risposte (anno, stato, ricevuto_il desc);

create index risposte_inviato_anno_id_idx
    on public.risposte (inviato_da, anno, id desc);

create index risposte_elaborato_da_idx
    on public.risposte (elaborato_da)
    where elaborato_da is not null;

create index risposte_payload_gin_idx
    on public.risposte using gin (risposta_json jsonb_path_ops);

alter table public.campagne enable row level security;
alter table public.amministratori enable row level security;
alter table public.risposte enable row level security;
alter table private.account_personale_condiviso enable row level security;

create or replace function private.is_personale_condiviso()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select (select auth.uid()) is not null
       and exists (
           select 1
             from private.account_personale_condiviso p
            where p.user_id = (select auth.uid())
       );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select (select auth.uid()) is not null
       and exists (
           select 1
             from public.amministratori a
            where a.user_id = (select auth.uid())
       );
$$;

revoke all on function private.is_personale_condiviso() from public, anon;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_personale_condiviso() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;

create or replace function private.campagna_aperta(p_anno smallint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
          from public.campagne c
         where c.anno = p_anno
           and c.aperta
           and (c.apertura_il is null or now() >= c.apertura_il)
           and (c.chiusura_il is null or now() < c.chiusura_il)
    );
$$;

revoke all on function private.campagna_aperta(smallint) from public, anon;
grant execute on function private.campagna_aperta(smallint) to authenticated, service_role;

create or replace function private.valida_risposta_ofcn()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
    blocco_anno jsonb;
    scheda jsonb;
    matricola_chiave text;
    priorita jsonb;
    punteggi jsonb;
    punteggio_testo text;
    posizione integer;
    turno integer;
begin
    if (select auth.uid()) is null or new.inviato_da <> (select auth.uid()) then
        raise exception 'Identità di invio non valida';
    end if;

    if not private.is_personale_condiviso() then
        raise exception 'Account non autorizzato all''invio';
    end if;

    if not private.campagna_aperta(new.anno) then
        raise exception 'Campagna % non aperta', new.anno;
    end if;

    if jsonb_typeof(new.risposta_json) <> 'object' then
        raise exception 'Il payload deve essere un oggetto JSON';
    end if;

    if octet_length(new.risposta_json::text) > 262144 then
        raise exception 'Payload superiore al limite di 256 KiB';
    end if;

    if new.risposta_json ->> 'tipoFile' <> 'schede_operative_ofcn' then
        raise exception 'tipoFile non supportato';
    end if;

    if coalesce(new.risposta_json ->> 'versione', '') !~ '^[0-9]+$'
       or (new.risposta_json ->> 'versione')::integer <> 1 then
        raise exception 'Versione payload non supportata';
    end if;

    if coalesce(new.risposta_json ->> 'annoCorrente', '') !~ '^[0-9]{4}$'
       or (new.risposta_json ->> 'annoCorrente')::smallint <> new.anno then
        raise exception 'Anno del payload non coerente';
    end if;

    if jsonb_typeof(new.risposta_json -> 'schedeOperative') <> 'object'
       or (
           select count(*)
             from jsonb_object_keys(new.risposta_json -> 'schedeOperative')
       ) <> 1 then
        raise exception 'Il payload deve contenere un solo blocco anno';
    end if;

    blocco_anno := new.risposta_json -> 'schedeOperative' -> new.anno::text;

    if jsonb_typeof(blocco_anno) <> 'object'
       or (
           select count(*)
             from jsonb_object_keys(blocco_anno)
       ) <> 1 then
        raise exception 'Il payload deve contenere una sola scheda';
    end if;

    select key, value
      into matricola_chiave, scheda
      from jsonb_each(blocco_anno)
     limit 1;

    if nullif(btrim(matricola_chiave), '') is null
       or length(matricola_chiave) > 50 then
        raise exception 'Matricola non valida';
    end if;

    if jsonb_typeof(scheda) <> 'object'
       or btrim(coalesce(scheda ->> 'matricola', '')) <> btrim(matricola_chiave)
       or coalesce(scheda ->> 'anno', '') !~ '^[0-9]{4}$'
       or (scheda ->> 'anno')::smallint <> new.anno
       or nullif(btrim(scheda ->> 'cognome'), '') is null
       or length(scheda ->> 'cognome') > 100
       or nullif(btrim(scheda ->> 'nome'), '') is null
       or length(scheda ->> 'nome') > 100
       or btrim(coalesce(scheda ->> 'nominativo', ''))
          <> btrim(concat_ws(' ', scheda ->> 'cognome', scheda ->> 'nome')) then
        raise exception 'Identità o anno della scheda non validi';
    end if;

    priorita := scheda #> '{preferenze,ordinePrioritaTurni}';
    punteggi := scheda #> '{preferenze,punteggiPrioritaTurni}';

    if jsonb_typeof(priorita) <> 'array'
       or jsonb_array_length(priorita) <> 6 then
        raise exception 'L''ordine di priorità deve contenere sei turni';
    end if;

    if exists (
           select 1
             from jsonb_array_elements_text(priorita) elemento(valore)
            where elemento.valore !~ '^[1-6]$'
       )
       or (
           select count(distinct elemento.valore)
             from jsonb_array_elements_text(priorita) elemento(valore)
       ) <> 6 then
        raise exception 'Ogni turno da 1 a 6 deve comparire una sola volta';
    end if;

    if jsonb_typeof(punteggi) <> 'object'
       or (
           select count(*)
             from jsonb_object_keys(punteggi)
       ) <> 6 then
        raise exception 'Punteggi di priorità non validi';
    end if;

    for posizione in 0..5 loop
        turno := (priorita ->> posizione)::integer;
        punteggio_testo := punteggi ->> ('T' || turno::text);

        if coalesce(punteggio_testo, '') !~ '^[1-6]$'
           or punteggio_testo::integer <> 6 - posizione then
            raise exception 'Punteggio non coerente per il turno %', turno;
        end if;
    end loop;

    return new;
end;
$$;

revoke all on function private.valida_risposta_ofcn() from public, anon;
grant execute on function private.valida_risposta_ofcn() to authenticated, service_role;

create trigger risposte_valida_prima_insert
before insert on public.risposte
for each row execute function private.valida_risposta_ofcn();

create or replace function private.gestisci_stato_risposta()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if new.stato = 'nuova' then
        new.elaborato_il := null;
        new.elaborato_da := null;
    elsif new.stato is distinct from old.stato then
        new.elaborato_il := clock_timestamp();
        new.elaborato_da := (select auth.uid());
    end if;

    return new;
end;
$$;

revoke all on function private.gestisci_stato_risposta() from public, anon;
grant execute on function private.gestisci_stato_risposta() to authenticated, service_role;

create trigger risposte_gestisci_stato_prima_update
before update of stato on public.risposte
for each row execute function private.gestisci_stato_risposta();

create policy campagne_lettura_account_autorizzati
on public.campagne
for select
to authenticated
using (
    (select private.is_admin())
    or (
        (select private.is_personale_condiviso())
        and aperta
        and (apertura_il is null or now() >= apertura_il)
        and (chiusura_il is null or now() < chiusura_il)
    )
);

create policy amministratori_lettura_proprio_ruolo
on public.amministratori
for select
to authenticated
using (user_id = (select auth.uid()));

create policy risposte_inserimento_account_condiviso
on public.risposte
for insert
to authenticated
with check (
    (select private.is_personale_condiviso())
    and inviato_da = (select auth.uid())
    and (select private.campagna_aperta(anno))
);

create policy risposte_lettura_amministratori
on public.risposte
for select
to authenticated
using ((select private.is_admin()));

create policy risposte_aggiornamento_amministratori
on public.risposte
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke all on table public.campagne from public, anon, authenticated;
revoke all on table public.amministratori from public, anon, authenticated;
revoke all on table public.risposte from public, anon, authenticated;

grant select on table public.campagne to authenticated;
grant select on table public.amministratori to authenticated;
grant select on table public.risposte to authenticated;
grant insert (submission_id, anno, risposta_json) on table public.risposte to authenticated;
grant update (stato) on table public.risposte to authenticated;
grant usage, select on sequence public.risposte_id_seq to authenticated;

grant select, insert, update, delete on table public.campagne to service_role;
grant select, insert, update, delete on table public.amministratori to service_role;
grant select, insert, update, delete on table public.risposte to service_role;
grant usage, select on sequence public.risposte_id_seq to service_role;
