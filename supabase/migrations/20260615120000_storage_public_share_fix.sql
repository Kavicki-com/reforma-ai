-- SECURITY DEFINER para validar o share ignorando o RLS de public_shares:
-- o papel anon não enxerga a tabela, então um EXISTS direto na policy falharia.

create or replace function public.storage_object_has_public_share(object_name text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.public_shares ps
    where ps.enabled = true
      and ps.project_id = public.safe_uuid((string_to_array(object_name, '/'))[1])
  );
$$;

drop policy if exists storage_select_public_share on storage.objects;
create policy storage_select_public_share on storage.objects
  for select to anon
  using (bucket_id = 'fotos' and public.storage_object_has_public_share(name));
