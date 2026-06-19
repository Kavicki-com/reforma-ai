-- Notas e comprovantes: repositório de documentos da obra (nível projeto).
-- Cada documento (nota fiscal, comprovante de pagamento, outro) pode se
-- relacionar a vários materiais (shopping_items) e/ou custos (entries).

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null default 'outro' check (kind in ('nota_fiscal','comprovante','outro')),
  title text,
  doc_date date,
  amount numeric,
  party text,                 -- emissor da nota / recebedor do pagamento
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists documents_project_idx on public.documents(project_id);

alter table public.documents enable row level security;
drop policy if exists documents_all_own on public.documents;
create policy documents_all_own on public.documents
  for all
  using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

-- Vínculo N:N com materiais
create table if not exists public.document_items (
  document_id uuid not null references public.documents(id) on delete cascade,
  shopping_item_id uuid not null references public.shopping_items(id) on delete cascade,
  primary key (document_id, shopping_item_id)
);
alter table public.document_items enable row level security;
drop policy if exists document_items_all_own on public.document_items;
create policy document_items_all_own on public.document_items
  for all
  using (exists (select 1 from public.documents d where d.id = document_id and public.owns_project(d.project_id)))
  with check (exists (select 1 from public.documents d where d.id = document_id and public.owns_project(d.project_id)));

-- Vínculo N:N com custos
create table if not exists public.document_entries (
  document_id uuid not null references public.documents(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  primary key (document_id, entry_id)
);
alter table public.document_entries enable row level security;
drop policy if exists document_entries_all_own on public.document_entries;
create policy document_entries_all_own on public.document_entries
  for all
  using (exists (select 1 from public.documents d where d.id = document_id and public.owns_project(d.project_id)))
  with check (exists (select 1 from public.documents d where d.id = document_id and public.owns_project(d.project_id)));
