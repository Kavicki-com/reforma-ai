-- Resumo público: cada categoria passa a trazer também os materiais
-- (shopping_items sem entry) daquela categoria, além dos lançamentos. Assim a
-- "Lista de materiais" deixa de ser uma seção solta e fica dentro de cada
-- categoria, conforme o redesign. Mantém o bucket "Sem categoria" para
-- lançamentos e materiais sem category_id.

create or replace function public.get_obra_summary(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_project_id uuid;
  v_result jsonb;
begin
  select project_id into v_project_id
  from public.public_shares
  where token = p_token and enabled = true;

  if v_project_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'project',   (select jsonb_build_object('name', name, 'status', status)
                  from public.projects where id = v_project_id),
    'totals',    (select to_jsonb(t) from public.v_project_totals t where t.project_id = v_project_id),
    'categories', (
                  select coalesce(jsonb_agg(sub.c order by sub.ord desc nulls last), '[]'::jsonb)
                  from (
                    -- Categorias com category_id
                    select jsonb_build_object(
                             'category_name', vct.category_name,
                             'total_expense', vct.total_expense,
                             'items', coalesce((
                               select jsonb_agg(jsonb_build_object(
                                        'description', e.description,
                                        'amount', e.amount,
                                        'paid_amount', e.paid_amount,
                                        'status', e.status,
                                        'type', e.type,
                                        'entry_date', e.entry_date,
                                        'paid_at', e.paid_at,
                                        'payee', e.payee,
                                        'attachments', coalesce((
                                          select jsonb_agg(jsonb_build_object(
                                                   'file_path', a.file_path,
                                                   'file_name', a.file_name,
                                                   'mime_type', a.mime_type)
                                                 order by a.created_at)
                                          from public.attachments a where a.entry_id = e.id), '[]'::jsonb))
                                      order by e.entry_date desc, e.created_at desc)
                               from public.entries e
                               where e.project_id = v_project_id and e.category_id = vct.category_id), '[]'::jsonb),
                             'materials', coalesce((
                               select jsonb_agg(jsonb_build_object(
                                        'name', si.name, 'quantity', si.quantity, 'unit', si.unit,
                                        'status', si.status, 'estimated_total', si.estimated_total)
                                      order by si.status, si.name)
                               from public.shopping_items si
                               where si.project_id = v_project_id and si.category_id = vct.category_id
                                 and si.entry_id is null), '[]'::jsonb)
                           ) as c,
                           vct.total_expense as ord
                    from public.v_category_totals vct
                    where vct.project_id = v_project_id

                    union all

                    -- Lançamentos e materiais sem categoria
                    select jsonb_build_object(
                             'category_name', 'Sem categoria',
                             'total_expense',
                               (select coalesce(sum(amount), 0) from public.entries
                                 where project_id = v_project_id and category_id is null)
                               + (select coalesce(sum(estimated_total), 0) from public.shopping_items
                                   where project_id = v_project_id and category_id is null and entry_id is null),
                             'items', coalesce((
                               select jsonb_agg(jsonb_build_object(
                                        'description', e.description,
                                        'amount', e.amount,
                                        'paid_amount', e.paid_amount,
                                        'status', e.status,
                                        'type', e.type,
                                        'entry_date', e.entry_date,
                                        'paid_at', e.paid_at,
                                        'payee', e.payee,
                                        'attachments', coalesce((
                                          select jsonb_agg(jsonb_build_object(
                                                   'file_path', a.file_path,
                                                   'file_name', a.file_name,
                                                   'mime_type', a.mime_type)
                                                 order by a.created_at)
                                          from public.attachments a where a.entry_id = e.id), '[]'::jsonb))
                                      order by e.entry_date desc, e.created_at desc)
                               from public.entries e
                               where e.project_id = v_project_id and e.category_id is null), '[]'::jsonb),
                             'materials', coalesce((
                               select jsonb_agg(jsonb_build_object(
                                        'name', si.name, 'quantity', si.quantity, 'unit', si.unit,
                                        'status', si.status, 'estimated_total', si.estimated_total)
                                      order by si.status, si.name)
                               from public.shopping_items si
                               where si.project_id = v_project_id and si.category_id is null
                                 and si.entry_id is null), '[]'::jsonb)
                           ) as c,
                           (select coalesce(sum(amount), 0) from public.entries
                             where project_id = v_project_id and category_id is null) as ord
                    where exists (select 1 from public.entries
                                   where project_id = v_project_id and category_id is null)
                       or exists (select 1 from public.shopping_items
                                   where project_id = v_project_id and category_id is null and entry_id is null)
                  ) sub
                ),
    'stages',    coalesce((
                  select jsonb_agg(jsonb_build_object(
                           'name', name, 'status', status, 'start_date', start_date,
                           'end_date', end_date, 'completed_at', completed_at, 'budget', budget)
                         order by start_date nulls last)
                  from public.v_stage_totals where project_id = v_project_id), '[]'::jsonb),
    'materials', (select jsonb_build_object(
                    'to_buy', count(*) filter (where status = 'a_comprar'),
                    'bought', count(*) filter (where status = 'comprado'),
                    'estimated_to_buy', coalesce(sum(estimated_total) filter (where status = 'a_comprar'), 0))
                  from public.shopping_items where project_id = v_project_id),
    'photos',    coalesce((
                  select jsonb_agg(jsonb_build_object(
                           'file_path', file_path, 'caption', caption,
                           'taken_at', taken_at, 'created_at', created_at)
                         order by coalesce(taken_at::timestamptz, created_at) desc)
                  from public.photos where project_id = v_project_id), '[]'::jsonb),
    'progress',  (
      select case when cnt_s = 0 then 0
                  else round((pts_s::numeric / cnt_s) * 100) end
      from (
        select coalesce(sum(case status
                              when 'concluida' then 1
                              when 'em_andamento' then 0.5
                              when 'pausada' then 0.5
                              else 0 end), 0) as pts_s,
               count(*) as cnt_s
        from public.stages where project_id = v_project_id
      ) ss
    )
  ) into v_result;

  return v_result;
end;
$function$;
