-- Instradamento separato 2° Gruppo / 50° Gruppo e nuovi campi desiderata.
-- Le risposte precedenti restano senza reparto_destinatario e non sono alterate.

alter table public.amministratori
    add column reparto text;

alter table public.amministratori
    add constraint amministratori_reparto_valido
    check (reparto in ('2_GRUPPO', '50_GRUPPO'));

alter table public.amministratori
    alter column reparto set not null;

alter table public.risposte
    add column reparto_destinatario text generated always as
        (risposta_json ->> 'repartoDestinatario') stored;

alter table public.risposte
    add constraint risposte_reparto_destinatario_valido
    check (reparto_destinatario in ('2_GRUPPO', '50_GRUPPO'));

create index risposte_reparto_anno_stato_ricevuto_idx
    on public.risposte (reparto_destinatario, anno, stato, ricevuto_il desc);

create or replace function private.is_admin_reparto(p_reparto text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select (select auth.uid()) is not null
       and p_reparto in ('2_GRUPPO', '50_GRUPPO')
       and exists (
           select 1
             from public.amministratori a
            where a.user_id = (select auth.uid())
              and a.reparto = p_reparto
       );
$$;

revoke all on function private.is_admin_reparto(text) from public, anon;
grant execute on function private.is_admin_reparto(text) to authenticated, service_role;

create or replace function private.valida_reparto_formazione_ofcn()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
    blocco_anno jsonb;
    scheda jsonb;
    reparto_destinatario text;
    corsi_qualifiche_desiderati jsonb;
    esercitazioni_desiderate jsonb;
begin
    blocco_anno := new.risposta_json -> 'schedeOperative' -> new.anno::text;

    select value
      into scheda
      from jsonb_each(blocco_anno)
     limit 1;

    reparto_destinatario := new.risposta_json ->> 'repartoDestinatario';
    corsi_qualifiche_desiderati := scheda -> 'corsiQualificheDesiderati';
    esercitazioni_desiderate := scheda -> 'esercitazioniDesiderate';

    if coalesce(reparto_destinatario, '') not in ('2_GRUPPO', '50_GRUPPO')
       or coalesce(scheda ->> 'repartoDestinatario', '') <> reparto_destinatario then
        raise exception 'Reparto destinatario non valido o non coerente';
    end if;

    if jsonb_typeof(corsi_qualifiche_desiderati) is distinct from 'string'
       or length(scheda ->> 'corsiQualificheDesiderati') > 4000
       or jsonb_typeof(esercitazioni_desiderate) is distinct from 'string'
       or length(scheda ->> 'esercitazioniDesiderate') > 4000 then
        raise exception 'Formazione o esercitazioni desiderate non valide';
    end if;

    return new;
end;
$$;

revoke all on function private.valida_reparto_formazione_ofcn() from public, anon;
grant execute on function private.valida_reparto_formazione_ofcn() to authenticated, service_role;

create trigger risposte_valida_reparto_formazione_prima_insert
before insert on public.risposte
for each row execute function private.valida_reparto_formazione_ofcn();

drop policy risposte_lettura_amministratori on public.risposte;
create policy risposte_lettura_amministratori
on public.risposte
for select
to authenticated
using ((select private.is_admin_reparto(reparto_destinatario)));

drop policy risposte_aggiornamento_amministratori on public.risposte;
create policy risposte_aggiornamento_amministratori
on public.risposte
for update
to authenticated
using ((select private.is_admin_reparto(reparto_destinatario)))
with check ((select private.is_admin_reparto(reparto_destinatario)));
