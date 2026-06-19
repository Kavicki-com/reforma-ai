-- Resumo público: cada categoria passa a trazer os lançamentos (entries) que a
-- compõem, com todos os campos + anexos, para a view em accordion do link
-- compartilhado. Mantém o total_expense da v_category_totals (entries+materiais)
-- e acrescenta um bucket "Sem categoria" para lançamentos sem category_id.

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
                    -- Categorias com category_id (total = entries + materiais)
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
                               where e.project_id = v_project_id and e.category_id = vct.category_id), '[]'::jsonb)
                           ) as c,
                           vct.total_expense as ord
                    from public.v_category_totals vct
                    where vct.project_id = v_project_id

                    union all

                    -- Lançamentos sem categoria
                    select jsonb_build_object(
                             'category_name', 'Sem categoria',
                             'total_expense', coalesce(sum(e.amount), 0),
                             'items', coalesce(jsonb_agg(jsonb_build_object(
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
                                      order by e.entry_date desc, e.created_at desc), '[]'::jsonb)
                           ) as c,
                           coalesce(sum(e.amount), 0) as ord
                    from public.entries e
                    where e.project_id = v_project_id and e.category_id is null
                    having count(*) > 0
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
    'material_list', coalesce((
                  select jsonb_agg(jsonb_build_object(
                           'name', name, 'quantity', quantity, 'unit', unit,
                           'status', status, 'estimated_total', estimated_total)
                         order by status, name)
                  from public.shopping_items where project_id = v_project_id), '[]'::jsonb),
    'photos',    coalesce((
                  select jsonb_agg(jsonb_build_object(
                           'file_path', file_path, 'caption', caption,
                           'taken_at', taken_at, 'created_at', created_at)
                         order by coalesce(taken_at::timestamptz, created_at) desc)
                  from public.photos where project_id = v_project_id), '[]'::jsonb),
    -- Progresso da obra: só etapas (compras de material não contam).
    -- Peso: concluída=1, em andamento/pausada=0,5, pendente=0.
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
