-- Ajustes apontados pelo advisor sobre as funções criadas em 2026-06-10:
-- search_path fixo e EXECUTE mínimo (RPC não deve expor helpers internos).
-- Aplicada em produção em 2026-06-10 (migration harden_helper_functions).
alter function public.safe_uuid(text) set search_path = '';

-- Usada pelas policies do Storage (rodam como authenticated): manter o grant.
revoke execute on function public.owns_storage_object(text, text) from public, anon;
grant execute on function public.owns_storage_object(text, text) to authenticated;

-- Trigger function e helper interno: ninguém chama via RPC.
revoke execute on function public.leads_anti_abuse() from public, anon, authenticated;
revoke execute on function public.safe_uuid(text) from public, anon, authenticated;
