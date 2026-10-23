-- Migration 007: Four-step order workflow timeline and admin control functions.
-- Idempotent, safe to rerun. Never drops tables or columns.

-- 1. Add workflow tracking and link columns to public.orders
alter table public.orders
  add column if not exists workflow_step smallint not null default 0
    check (workflow_step between 0 and 4),
  add column if not exists step1_at timestamptz,
  add column if not exists step2_at timestamptz,
  add column if not exists step3_at timestamptz,
  add column if not exists step4_at timestamptz,
  add column if not exists preview_link text
    check (preview_link is null or (length(preview_link) <= 2000 and preview_link ~* '^https://')),
  add column if not exists final_link text
    check (final_link is null or (length(final_link) <= 2000 and final_link ~* '^https://'));

create index if not exists orders_workflow_step_idx on public.orders(workflow_step);

-- 2. Complete a workflow step (strictly in order, enforcing business requirements)
create or replace function public.admin_complete_step(p_order_id uuid, p_step int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders%rowtype;
  payment_row public.payments%rowtype;
  verified_total integer;
  v_tid text;
  v_next_payment_status public.payment_status;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_step is null or p_step < 1 or p_step > 4 then
    raise exception 'Step must be between 1 and 4';
  end if;

  select * into target
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  -- Harmless if repeated call for the current or earlier completed step
  if target.workflow_step >= p_step then
    return jsonb_build_object(
      'id', target.id,
      'public_id', target.public_id,
      'workflow_step', target.workflow_step,
      'order_status', target.order_status,
      'payment_status', target.payment_status,
      'already_completed', true
    );
  end if;

  -- Enforce strictly sequential progression
  if p_step <> target.workflow_step + 1 then
    raise exception 'Cannot skip workflow steps';
  end if;

  if p_step = 1 then
    update public.orders
    set workflow_step = 1,
        step1_at = coalesce(step1_at, now())
    where id = p_order_id
    returning * into target;

    insert into public.order_events(order_id, type, to_value, actor, actor_user_id)
    values (target.id, 'step_completed', 'Step 1: Order received', 'admin', auth.uid());

  elsif p_step = 2 then
    -- Check for payment record and TID
    select * into payment_row
    from public.payments
    where order_id = p_order_id
    order by submitted_at desc
    limit 1;

    v_tid := nullif(trim(target.details->'invitation'->'details'->'payment'->>'tid'), '');

    if payment_row.id is null then
      if v_tid is null then
        raise exception 'Step 2 requires a valid Transaction ID (TID)';
      end if;
      insert into public.payments(order_id, method, amount_minor, currency, reference, status, verified_by, verified_at)
      values (target.id, 'other', round(target.total_minor * 0.5)::integer, target.currency, v_tid, 'verified', auth.uid(), now())
      returning * into payment_row;
    else
      if (payment_row.reference is null or trim(payment_row.reference) = '') and v_tid is not null then
        update public.payments
        set reference = v_tid,
            status = 'verified',
            verified_by = auth.uid(),
            verified_at = now()
        where id = payment_row.id;
      else
        if payment_row.reference is null or trim(payment_row.reference) = '' then
          raise exception 'Step 2 requires a valid Transaction ID (TID)';
        end if;
        update public.payments
        set status = 'verified',
            verified_by = auth.uid(),
            verified_at = now()
        where id = payment_row.id;
      end if;
    end if;

    select coalesce(sum(amount_minor), 0) into verified_total
    from public.payments
    where order_id = target.id and status = 'verified';

    v_next_payment_status := case
      when verified_total >= target.total_minor then 'paid'::public.payment_status
      else 'partially_paid'::public.payment_status
    end;

    update public.orders
    set workflow_step = 2,
        step2_at = coalesce(step2_at, now()),
        order_status = 'in_progress',
        payment_status = v_next_payment_status
    where id = p_order_id
    returning * into target;

    insert into public.order_events(order_id, type, to_value, actor, actor_user_id)
    values (target.id, 'step_completed', 'Step 2: Advance payment verified', 'admin', auth.uid());

  elsif p_step = 3 then
    if target.preview_link is null or trim(target.preview_link) = '' then
      raise exception 'Step 3 requires a saved preview link';
    end if;

    update public.orders
    set workflow_step = 3,
        step3_at = coalesce(step3_at, now()),
        order_status = 'awaiting_customer_approval'
    where id = p_order_id
    returning * into target;

    insert into public.order_events(order_id, type, to_value, actor, actor_user_id)
    values (target.id, 'step_completed', 'Step 3: Preview ready', 'admin', auth.uid());

  elsif p_step = 4 then
    if target.final_link is null or trim(target.final_link) = '' then
      raise exception 'Step 4 requires a saved final link';
    end if;

    update public.orders
    set workflow_step = 4,
        step4_at = coalesce(step4_at, now()),
        order_status = 'completed'
    where id = p_order_id
    returning * into target;

    insert into public.order_events(order_id, type, to_value, actor, actor_user_id)
    values (target.id, 'step_completed', 'Step 4: Invitation completed', 'admin', auth.uid());
  end if;

  return jsonb_build_object(
    'id', target.id,
    'public_id', target.public_id,
    'workflow_step', target.workflow_step,
    'order_status', target.order_status,
    'payment_status', target.payment_status,
    'already_completed', false
  );
end;
$$;

-- 3. Undo latest completed workflow step only
create or replace function public.admin_undo_step(p_order_id uuid)
returns jsonb
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

  if target.workflow_step = 0 then
    raise exception 'No completed steps to undo';
  end if;

  if target.workflow_step = 4 then
    update public.orders
    set workflow_step = 3,
        step4_at = null,
        order_status = 'awaiting_customer_approval'
    where id = p_order_id
    returning * into target;

    insert into public.order_events(order_id, type, to_value, actor, actor_user_id)
    values (target.id, 'step_undone', 'Step 4 undone', 'admin', auth.uid());

  elsif target.workflow_step = 3 then
    update public.orders
    set workflow_step = 2,
        step3_at = null,
        order_status = 'in_progress'
    where id = p_order_id
    returning * into target;

    insert into public.order_events(order_id, type, to_value, actor, actor_user_id)
    values (target.id, 'step_undone', 'Step 3 undone', 'admin', auth.uid());

  elsif target.workflow_step = 2 then
    update public.payments
    set status = 'submitted',
        verified_by = null,
        verified_at = null
    where order_id = p_order_id and status = 'verified';

    update public.orders
    set workflow_step = 1,
        step2_at = null,
        order_status = 'new',
        payment_status = case
          when exists (select 1 from public.payments where order_id = p_order_id) then 'payment_submitted'::public.payment_status
          else 'awaiting_payment'::public.payment_status
        end
    where id = p_order_id
    returning * into target;

    insert into public.order_events(order_id, type, to_value, actor, actor_user_id)
    values (target.id, 'step_undone', 'Step 2 undone', 'admin', auth.uid());

  elsif target.workflow_step = 1 then
    update public.orders
    set workflow_step = 0,
        step1_at = null,
        order_status = 'new'
    where id = p_order_id
    returning * into target;

    insert into public.order_events(order_id, type, to_value, actor, actor_user_id)
    values (target.id, 'step_undone', 'Step 1 undone', 'admin', auth.uid());
  end if;

  return jsonb_build_object(
    'id', target.id,
    'public_id', target.public_id,
    'workflow_step', target.workflow_step,
    'order_status', target.order_status,
    'payment_status', target.payment_status
  );
end;
$$;

-- 4. Set preview or final link
create or replace function public.admin_set_link(p_order_id uuid, p_kind text, p_url text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders%rowtype;
  v_url text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_kind not in ('preview', 'final') then
    raise exception 'Invalid link kind: must be preview or final';
  end if;

  select * into target
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if p_kind = 'preview' and target.workflow_step >= 3 then
    raise exception 'Cannot modify preview link while Step 3 is completed. Undo Step 3 first.';
  end if;

  if p_kind = 'final' and target.workflow_step >= 4 then
    raise exception 'Cannot modify final link while Step 4 is completed. Undo Step 4 first.';
  end if;

  v_url := nullif(trim(p_url), '');
  if v_url is not null then
    if length(v_url) > 2000 or v_url !~* '^https://' then
      raise exception 'Link must be a valid https URL up to 2000 characters';
    end if;
  end if;

  if p_kind = 'preview' then
    update public.orders
    set preview_link = v_url
    where id = p_order_id
    returning * into target;
  else
    update public.orders
    set final_link = v_url
    where id = p_order_id
    returning * into target;
  end if;

  insert into public.order_events(order_id, type, to_value, actor, actor_user_id)
  values (target.id, 'link_updated', p_kind || ' link set to ' || coalesce(v_url, 'empty'), 'admin', auth.uid());

  return jsonb_build_object(
    'id', target.id,
    'public_id', target.public_id,
    'kind', p_kind,
    'url', v_url
  );
end;
$$;

-- 5. Set Transaction ID (TID)
create or replace function public.admin_set_tid(p_order_id uuid, p_tid text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders%rowtype;
  v_tid text;
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

  v_tid := trim(p_tid);
  if v_tid is null or length(v_tid) < 1 or length(v_tid) > 160 then
    raise exception 'Transaction ID must be between 1 and 160 characters';
  end if;

  begin
    if exists (select 1 from public.payments where order_id = p_order_id) then
      update public.payments
      set reference = v_tid
      where id = (select id from public.payments where order_id = p_order_id order by submitted_at desc limit 1);
    else
      insert into public.payments(order_id, method, amount_minor, currency, reference, status)
      values (target.id, 'other', round(target.total_minor * 0.5)::integer, target.currency, v_tid, 'submitted');
    end if;
  exception when unique_violation then
    raise exception 'This Transaction ID is already associated with an order';
  end;

  update public.orders
  set details = jsonb_set(
    coalesce(details, '{}'::jsonb),
    '{invitation,details,payment,tid}',
    to_jsonb(v_tid),
    true
  )
  where id = p_order_id
  returning * into target;

  insert into public.order_events(order_id, type, to_value, actor, actor_user_id)
  values (target.id, 'tid_updated', 'TID set to ' || v_tid, 'admin', auth.uid());

  return jsonb_build_object(
    'id', target.id,
    'public_id', target.public_id,
    'tid', v_tid
  );
end;
$$;

-- 6. Record WhatsApp opened for a step
create or replace function public.admin_record_step_whatsapp(p_order_id uuid, p_step int)
returns jsonb
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
  where id = p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  insert into public.order_events(order_id, type, to_value, actor, actor_user_id)
  values (target.id, 'step_whatsapp_opened', 'WhatsApp opened for Step ' || p_step || ' (not confirmed sent)', 'admin', auth.uid());

  return jsonb_build_object(
    'id', target.id,
    'public_id', target.public_id,
    'step', p_step,
    'opened_at', now()
  );
end;
$$;

-- 7. Secure execution grants (admin authenticated only, revoked from anon & public)
revoke all on function public.admin_complete_step(uuid, int) from public, anon, authenticated;
grant execute on function public.admin_complete_step(uuid, int) to authenticated;

revoke all on function public.admin_undo_step(uuid) from public, anon, authenticated;
grant execute on function public.admin_undo_step(uuid) to authenticated;

revoke all on function public.admin_set_link(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_link(uuid, text, text) to authenticated;

revoke all on function public.admin_set_tid(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_tid(uuid, text) to authenticated;

revoke all on function public.admin_record_step_whatsapp(uuid, int) from public, anon, authenticated;
grant execute on function public.admin_record_step_whatsapp(uuid, int) to authenticated;

