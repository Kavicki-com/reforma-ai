-- Seção "Notas e comprovantes" no link público, protegida por senha própria
-- (independente do password_hash, que é de outro plano). A senha fica em
-- public_shares.docs_password_hash; a verificação e a entrega dos documentos
-- (com signed URLs) acontecem via edge function, sem expor o bucket ao anon.

alter table public.public_shares add column if not exists docs_password_hash text;

-- Define / remove a senha da seção de documentos (hash via pgcrypto).
create or replace function public.set_share_docs_password(p_project_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.owns_project(p_project_id) then
    raise exception 'not authorized';
  end if;
  update public.public_shares
     set docs_password_hash = case
       when p_password is null or length(trim(p_password)) = 0 then null
       else extensions.crypt(p_password, extensions.gen_salt('bf'))
     end
   where project_id = p_project_id and enabled = true;
end;
$$;

-- Retorna os documentos do projeto SOMENTE se token + senha conferem.
create or replace function public.get_protected_documents(p_token text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_project_id uuid;
  v_ok boolean;
  v_result jsonb;
begin
  select project_id,
         (docs_password_hash is not null
           and docs_password_hash = extensions.crypt(p_password, docs_password_hash))
    into v_project_id, v_ok
  from public.public_shares
  where token = p_token and enabled = true;

  if v_project_id is null or not coalesce(v_ok, false) then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id,
           'kind', d.kind,
           'title', d.title,
           'doc_date', d.doc_date,
           'amount', d.amount,
           'party', d.party,
           'file_name', d.file_name,
           'file_path', d.file_path,
           'items', coalesce((
             select jsonb_agg(si.name order by si.name)
             from public.document_items di
             join public.shopping_items si on si.id = di.shopping_item_id
             where di.document_id = d.id), '[]'::jsonb),
           'entries', coalesce((
             select jsonb_agg(e.description order by e.description)
             from public.document_entries de
             join public.entries e on e.id = de.entry_id
             where de.document_id = d.id), '[]'::jsonb)
         ) order by d.doc_date desc nulls last, d.created_at desc), '[]'::jsonb)
    into v_result
  from public.documents d
  where d.project_id = v_project_id;

  return v_result;
end;
$$;
