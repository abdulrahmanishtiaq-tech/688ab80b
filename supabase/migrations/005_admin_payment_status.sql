create or replace function public.record_payment_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.payment_status is distinct from new.payment_status then
    insert into public.order_events(order_id, type, from_value, to_value, actor, actor_user_id)
    values (new.id, 'payment_status_changed', old.payment_status::text, new.payment_status::text,
      case when auth.uid() is null then 'system'::public.order_event_actor else 'admin'::public.order_event_actor end,
      auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists orders_record_payment_status_change on public.orders;
create trigger orders_record_payment_status_change after update of payment_status on public.orders
for each row execute function public.record_payment_status_change();

create or replace function public.set_payment_status(p_order_id uuid, next_status public.payment_status)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if next_status = 'paid' then raise exception 'Only verify_payment can mark an order paid'; end if;
  update public.orders set payment_status = next_status where id = p_order_id returning * into target;
  if not found then raise exception 'Order not found'; end if;
  return jsonb_build_object('public_id', target.public_id, 'payment_status', target.payment_status);
end;
$$;

revoke all on function public.set_payment_status(uuid, public.payment_status) from public, anon, authenticated;
grant execute on function public.set_payment_status(uuid, public.payment_status) to authenticated;

create or replace function public.verify_payment(payment_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.payments%rowtype;
  target public.orders%rowtype;
  verified_total integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into payment_row from public.payments where id = payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  update public.payments set status = 'verified', verified_by = auth.uid(), verified_at = now(), note = coalesce(p_note, note)
  where id = payment_id returning * into payment_row;
  select * into target from public.orders where id = payment_row.order_id;
  select coalesce(sum(amount_minor), 0) into verified_total
  from public.payments where order_id = target.id and status = 'verified';
  update public.orders set payment_status = case when verified_total >= total_minor then 'paid' else 'partially_paid' end
  where id = target.id;
  return jsonb_build_object('public_id', target.public_id, 'payment_status', (select payment_status from public.orders where id = target.id));
end;
$$;

create or replace function public.record_customer_chat_opened(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into target from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  insert into public.order_events(order_id, type, actor, actor_user_id)
  values (target.id, 'customer_chat_opened', 'admin', auth.uid());
  return jsonb_build_object('public_id', target.public_id, 'opened_at', now());
end;
$$;

revoke all on function public.record_customer_chat_opened(uuid) from public, anon, authenticated;
grant execute on function public.record_customer_chat_opened(uuid) to authenticated;
