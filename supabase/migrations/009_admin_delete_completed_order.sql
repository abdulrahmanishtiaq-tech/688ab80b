-- Migration 009: Admin-only permanent deletion of completed orders.
-- Related payments, notes and order events are removed by ON DELETE CASCADE.

create or replace function public.admin_delete_completed_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into target
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if target.order_status <> 'completed' then
    raise exception 'Only completed orders can be deleted';
  end if;

  delete from public.orders where id = p_order_id;
end;
$$;

revoke all on function public.admin_delete_completed_order(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_completed_order(uuid) to authenticated;
