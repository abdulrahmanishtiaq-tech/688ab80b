create or replace function public.admin_order_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'total_orders', count(*),
    'new_orders', count(*) filter (where order_status = 'new'),
    'awaiting_payment', count(*) filter (where payment_status = 'awaiting_payment'),
    'paid_orders', count(*) filter (where payment_status = 'paid'),
    'in_progress', count(*) filter (where order_status = 'in_progress'),
    'completed_orders', count(*) filter (where order_status = 'completed'),
    'confirmed_revenue_by_currency', coalesce((
      select jsonb_object_agg(currency, revenue)
      from (
        select currency, sum(total_minor) as revenue
        from public.orders
        where payment_status = 'paid'
        group by currency
      ) totals
    ), '{}'::jsonb)
  ) into result
  from public.orders;
  return result;
end;
$$;

revoke all on function public.admin_order_overview() from public, anon, authenticated;
grant execute on function public.admin_order_overview() to authenticated;
