create unique index if not exists payments_order_reference_unique_idx
on public.payments(order_id, reference);

create or replace function public.submit_payment_reference(token text, method public.payment_method, reference text, amount_minor integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders%rowtype;
  existing public.payments%rowtype;
begin
  select * into target
  from public.orders
  where access_token = token
  for update;
  if not found then raise exception 'Order not found'; end if;
  if target.order_status = 'cancelled' or target.payment_status in ('paid', 'refunded') then
    raise exception 'This order is not accepting payment submissions';
  end if;
  if amount_minor <= 0 or amount_minor > target.total_minor then
    raise exception 'Payment amount is invalid';
  end if;
  select * into existing
  from public.payments
  where order_id = target.id and payments.reference = $3;
  if found then
    return jsonb_build_object(
      'public_id', target.public_id,
      'payment_id', existing.id,
      'payment_status', target.payment_status,
      'duplicate', true
    );
  end if;
  insert into public.payments(order_id, method, amount_minor, currency, reference)
  values (target.id, $2, $4, target.currency, $3)
  returning * into existing;
  update public.orders set payment_status = 'payment_submitted' where id = target.id;
  return jsonb_build_object(
    'public_id', target.public_id,
    'payment_id', existing.id,
    'payment_status', 'payment_submitted',
    'duplicate', false
  );
end;
$$;

revoke all on function public.submit_payment_reference(text, public.payment_method, text, integer)
from public, anon, authenticated;
grant execute on function public.submit_payment_reference(text, public.payment_method, text, integer)
to anon;
