-- Anti-abuso na captura de leads (INSERT anônimo da landing page):
-- valida formato/tamanho e impõe teto global por hora. O front trata a
-- captura como best-effort e ignora erros, então nada muda para usuário real.
-- Aplicada em produção em 2026-06-10 (migration leads_anti_abuse).
create or replace function public.leads_anti_abuse()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.email is null
     or length(new.email) > 254
     or new.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email';
  end if;
  if new.full_name is not null and length(new.full_name) > 120 then
    raise exception 'invalid name';
  end if;
  if (select count(*) from public.leads where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate limit exceeded';
  end if;
  return new;
end;
$$;

drop trigger if exists leads_anti_abuse on public.leads;
create trigger leads_anti_abuse
  before insert on public.leads
  for each row execute function public.leads_anti_abuse();
