-- Fecha o furo de RLS no Storage: policies passam a validar o dono pelo path.
-- fotos/<project_id>/...  -> owns_project(project_id)
-- notas/<entry_id>/...    -> dono via entries -> projects.owner_id
-- Aplicada em produção em 2026-06-10 (migration storage_owner_rls).

create or replace function public.safe_uuid(t text)
returns uuid
language sql
immutable
as $$
  select case
    when t ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then t::uuid
    else null
  end;
$$;

create or replace function public.owns_storage_object(bucket text, object_path text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when bucket = 'fotos' then public.owns_project(public.safe_uuid((string_to_array(object_path, '/'))[1]))
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
  using (bucket_id in ('notas','fotos') and public.owns_storage_object(bucket_id, name));

drop policy if exists storage_insert_admin on storage.objects;
create policy storage_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id in ('notas','fotos') and is_admin() and public.owns_storage_object(bucket_id, name));

drop policy if exists storage_update_admin on storage.objects;
create policy storage_update_admin on storage.objects
  for update to authenticated
  using (bucket_id in ('notas','fotos') and is_admin() and public.owns_storage_object(bucket_id, name))
  with check (bucket_id in ('notas','fotos') and is_admin() and public.owns_storage_object(bucket_id, name));

drop policy if exists storage_delete_admin on storage.objects;
create policy storage_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id in ('notas','fotos') and is_admin() and public.owns_storage_object(bucket_id, name));
