-- Contador diário de uso de IA por usuário (rate-limit do extract-invoice).
-- Aplicada em produção em 2026-06-10 (migration ai_usage_limit).
create table if not exists public.ai_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (owner_id, day)
);

alter table public.ai_usage enable row level security;
-- Sem policies: apenas o service role (edge functions) lê/escreve.

-- Incrementa e devolve o total do dia, de forma atômica.
create or replace function public.bump_ai_usage(uid uuid)
returns integer
language sql
security definer
set search_path to 'public'
as $$
  insert into public.ai_usage (owner_id, day, count)
  values (uid, current_date, 1)
  on conflict (owner_id, day) do update set count = ai_usage.count + 1
  returning count;
$$;

revoke execute on function public.bump_ai_usage(uuid) from public, anon, authenticated;
