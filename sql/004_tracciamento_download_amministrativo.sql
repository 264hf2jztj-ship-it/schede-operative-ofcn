-- Registra l'avvio dei download amministrativi.
-- Il browser non può confermare che il file sia stato poi conservato sul dispositivo.

alter table public.risposte
  add column if not exists scaricato_il timestamptz,
  add column if not exists scaricato_da uuid references auth.users (id) on delete set null;

alter table public.risposte
  drop constraint if exists risposte_download_coerente;

alter table public.risposte
  add constraint risposte_download_coerente
  check (scaricato_da is null or scaricato_il is not null);

create index if not exists risposte_scaricato_da_idx
  on public.risposte (scaricato_da)
  where scaricato_da is not null;

create or replace function private.registra_download_risposta()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.is_admin_reparto(old.reparto_destinatario) then
    raise exception 'Download non autorizzato per il reparto';
  end if;

  new.scaricato_il := now();
  new.scaricato_da := auth.uid();
  return new;
end;
$$;

revoke all on function private.registra_download_risposta() from public, anon;
grant execute on function private.registra_download_risposta() to authenticated, service_role;

drop trigger if exists risposte_registra_download_prima_update on public.risposte;
create trigger risposte_registra_download_prima_update
before update of scaricato_il on public.risposte
for each row execute function private.registra_download_risposta();

grant update (scaricato_il) on table public.risposte to authenticated;
