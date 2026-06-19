-- Leitura pública dos anexos (bucket privado "notas") via link compartilhado.
-- Espelha a policy do bucket "fotos": SECURITY DEFINER para validar o share
-- ignorando o RLS de public_shares (anon não enxerga a tabela). O caminho do
-- objeto corresponde a attachments.file_path, então casamos direto por ele.

create or replace function public.storage_notas_has_public_share(object_name text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.attachments a
    join public.entries e on e.id = a.entry_id
    join public.public_shares ps on ps.project_id = e.project_id and ps.enabled = true
    where a.file_path = object_name
  );
$$;

drop policy if exists storage_select_notas_public_share on storage.objects;
create policy storage_select_notas_public_share on storage.objects
  for select to anon
  using (bucket_id = 'notas' and public.storage_notas_has_public_share(name));
