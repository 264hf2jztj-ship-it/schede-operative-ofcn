-- Consente agli amministratori di eliminare una scheda inviata per errore.
-- La RLS limita la cancellazione alle sole risposte del reparto assegnato.

grant delete on table public.risposte to authenticated;

drop policy if exists risposte_cancellazione_amministratori on public.risposte;
create policy risposte_cancellazione_amministratori
on public.risposte
for delete
to authenticated
using ((select private.is_admin_reparto(reparto_destinatario)));
