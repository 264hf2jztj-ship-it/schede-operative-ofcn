-- Limita a due i periodi di indisponibilità dichiarabili in ogni scheda.

create or replace function private.valida_limite_indisponibilita_ofcn()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
    blocco_anno jsonb;
    scheda jsonb;
    indisponibilita jsonb;
begin
    blocco_anno := new.risposta_json -> 'schedeOperative' -> new.anno::text;

    select value
      into scheda
      from jsonb_each(blocco_anno)
     limit 1;

    indisponibilita := scheda -> 'indisponibilita';

    if jsonb_typeof(indisponibilita) is distinct from 'array' then
        raise exception 'Indisponibilità non valide';
    end if;

    if jsonb_array_length(indisponibilita) > 2 then
        raise exception 'Sono consentiti al massimo 2 periodi di indisponibilità';
    end if;

    return new;
end;
$$;

revoke all on function private.valida_limite_indisponibilita_ofcn() from public, anon;
grant execute on function private.valida_limite_indisponibilita_ofcn() to authenticated, service_role;

drop trigger if exists risposte_valida_limite_indisponibilita_prima_insert
on public.risposte;

create trigger risposte_valida_limite_indisponibilita_prima_insert
before insert on public.risposte
for each row execute function private.valida_limite_indisponibilita_ofcn();
