-- Bucket privado para os documentos (notas e comprovantes), path:
-- documentos/<project_id>/...  -> owns_project(project_id), igual ao fotos.

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

create or replace function public.owns_storage_object(bucket text, object_path text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when bucket = 'fotos' then public.owns_project(public.safe_uuid((string_to_array(object_path, '/'))[1]))
    when bucket = 'documentos' then public.owns_project(public.safe_uuid((string_to_array(object_path, '/'))[1]))
    when bucket = 'notas' then exists (
      select 1
      from public.entries e
      join public.projects p on p.id = e.project_id
      where e.id = public.safe_uuid((string_to_array(object_path, '/'))[1])
        and p.owner_id = auth.uid()
    )
    else false
  end;
$$;

drop policy if exists storage_select_auth on storage.objects;
create policy storage_select_auth on storage.objects
  for select to authenticated
  using (bucket_id in ('notas','fotos','documentos') and public.owns_storage_object(bucket_id, name));

drop policy if exists storage_insert_admin on storage.objects;
create policy storage_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id in ('notas','fotos','documentos') and is_admin() and public.owns_storage_object(bucket_id, name));

drop policy if exists storage_update_admin on storage.objects;
create policy storage_update_admin on storage.objects
  for update to authenticated
  using (bucket_id in ('notas','fotos','documentos') and is_admin() and public.owns_storage_object(bucket_id, name))
  with check (bucket_id in ('notas','fotos','documentos') and is_admin() and public.owns_storage_object(bucket_id, name));

drop policy if exists storage_delete_admin on storage.objects;
create policy storage_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id in ('notas','fotos','documentos') and is_admin() and public.owns_storage_object(bucket_id, name));
