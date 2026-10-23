-- Migration 003: Core RPC functions, seed data, and role grants
-- Aligned with docs/order-system-spec.md and existing frontend callers

-- ============================================================================
-- 1. CATALOG SEED DATA
-- ============================================================================

insert into public.catalog_offers (
  id, label, active, list_price_minor, currency, discount_percent, discount_ends_at, express_price_minor
) values (
  'template-invitation',
  'Template Invitation',
  true,
  4000,
  'USD',
  50.00,
  null,
  500
)
on conflict (id) do update set
  label = excluded.label,
  active = excluded.active,
  list_price_minor = excluded.list_price_minor,
  currency = excluded.currency,
  discount_percent = excluded.discount_percent,
  discount_ends_at = excluded.discount_ends_at,
  express_price_minor = excluded.express_price_minor;

insert into public.catalog_templates (
  id, offer_id, label, active
) values (
  'vow-atelier',
  'template-invitation',
  'The Vow Atelier',
  true
)
on conflict (id) do update set
  offer_id = excluded.offer_id,
  label = excluded.label,
  active = excluded.active;

-- ============================================================================
-- 2. CUSTOMER ORDER CREATION (RPC)
-- ============================================================================

create or replace function public.create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_submission_id uuid;
  v_offer_id text;
  v_template_id text;
  v_customer_name text;
  v_whatsapp text;
  v_email text;
  v_event_type text;
  v_event_date date;
  v_groom text;
  v_bride text;
  v_host_names text;
  v_details jsonb;
  v_express boolean;

  existing_order public.orders%rowtype;
  offer_row public.catalog_offers%rowtype;
  template_row public.catalog_templates%rowtype;

  v_subtotal_minor integer;
  v_discount_minor integer := 0;
  v_express_minor integer := 0;
  v_total_minor integer;

  v_rate_count integer;
  v_current_year integer;
  v_next_counter integer;
  v_public_id text;
  v_access_token text;
  target_order public.orders%rowtype;
begin
  -- Validate required submission UUID
  begin
    v_submission_id := (payload->>'submission_id')::uuid;
  exception when others then
    raise exception 'Invalid or missing submission_id';
  end;

  if v_submission_id is null then
    raise exception 'Missing submission_id';
  end if;

  -- Idempotency check: return existing order if submission_id was already processed
  select * into existing_order
  from public.orders
  where submission_id = v_submission_id;

  if found then
    return jsonb_build_object(
      'id', existing_order.id,
      'public_id', existing_order.public_id,
      'submission_id', existing_order.submission_id,
      'access_token', existing_order.access_token,
      'offer_id', existing_order.offer_id,
      'template_id', existing_order.template_id,
      'customer_name', existing_order.customer_name,
      'whatsapp', existing_order.whatsapp,
      'email', existing_order.email,
      'event_type', existing_order.event_type,
      'event_date', existing_order.event_date,
      'host_names', existing_order.host_names,
      'currency', existing_order.currency,
      'subtotal_minor', existing_order.subtotal_minor,
      'discount_minor', existing_order.discount_minor,
      'express_minor', existing_order.express_minor,
      'total_minor', existing_order.total_minor,
      'payment_status', existing_order.payment_status,
      'order_status', existing_order.order_status,
      'created_at', existing_order.created_at
    );
  end if;

  -- Parse and validate customer contact details
  v_customer_name := nullif(trim(payload->'customer'->>'full_name'), '');
  if v_customer_name is null or length(v_customer_name) > 120 then
    raise exception 'Invalid customer name';
  end if;

  v_whatsapp := regexp_replace(coalesce(payload->'customer'->>'whatsapp', ''), '\D', '', 'g');
  if v_whatsapp !~ '^[0-9]{7,15}$' then
    raise exception 'Invalid WhatsApp number';
  end if;

  v_email := nullif(trim(payload->'customer'->>'email'), '');
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Invalid email address';
  end if;

  -- Enforce rate limit: max 5 orders per WhatsApp number per hour
  select count(*) into v_rate_count
  from public.orders
  where whatsapp = v_whatsapp
    and created_at >= (now() - interval '1 hour');

  if v_rate_count >= 5 then
    raise exception 'Order rate limit exceeded';
  end if;

  -- Validate catalog offer and template
  v_offer_id := nullif(trim(payload->>'offer_id'), '');
  v_template_id := nullif(trim(payload->>'template_id'), '');

  select * into offer_row
  from public.catalog_offers
  where id = v_offer_id and active = true;

  if not found then
    raise exception 'Offer not found';
  end if;

  select * into template_row
  from public.catalog_templates
  where id = v_template_id and offer_id = v_offer_id and active = true;

  if not found then
    raise exception 'Template not found';
  end if;

  -- Parse invitation details
  v_groom := nullif(trim(payload->'invitation'->>'groom_name'), '');
  v_bride := nullif(trim(payload->'invitation'->>'bride_name'), '');

  if v_groom is not null and v_bride is not null then
    v_host_names := v_groom || ' & ' || v_bride;
  elsif v_groom is not null then
    v_host_names := v_groom;
  elsif v_bride is not null then
    v_host_names := v_bride;
  else
    v_host_names := v_customer_name;
  end if;

  v_event_type := nullif(trim(payload->'invitation'->>'event_type'), '');

  begin
    v_event_date := nullif(trim(payload->'invitation'->>'wedding_date'), '')::date;
  exception when others then
    v_event_date := null;
  end;

  -- Preserve complete form data under details for confirmation slip and admin view
  v_details := jsonb_build_object(
    'customer', payload->'customer',
    'invitation', payload->'invitation',
    'delivery', payload->'delivery'
  );

  -- Authoritative server-side price calculation (ignores any client quotes)
  v_subtotal_minor := offer_row.list_price_minor;

  if offer_row.discount_percent > 0 and (offer_row.discount_ends_at is null or offer_row.discount_ends_at > now()) then
    v_discount_minor := round(offer_row.list_price_minor * (offer_row.discount_percent / 100.0))::integer;
  else
    v_discount_minor := 0;
  end if;

  v_express := coalesce((payload->'delivery'->>'express')::boolean, false);
  if v_express then
    v_express_minor := offer_row.express_price_minor;
  else
    v_express_minor := 0;
  end if;

  v_total_minor := v_subtotal_minor - v_discount_minor + v_express_minor;

  -- Generate atomic sequential Order ID (INV-YYYY-00001)
  v_current_year := extract(year from now())::integer;

  insert into public.order_counters (year, last_number)
  values (v_current_year, 1)
  on conflict (year) do update
  set last_number = public.order_counters.last_number + 1
  returning last_number into v_next_counter;

  v_public_id := 'INV-' || v_current_year::text || '-' || lpad(v_next_counter::text, 5, '0');

  -- Generate cryptographically random 96-char hex access token (48 bytes)
  v_access_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  -- Insert order record
  insert into public.orders (
    public_id,
    submission_id,
    access_token,
    offer_id,
    template_id,
    customer_name,
    whatsapp,
    email,
    event_type,
    event_date,
    host_names,
    details,
    currency,
    subtotal_minor,
    discount_minor,
    express_minor,
    total_minor,
    payment_status,
    order_status
  ) values (
    v_public_id,
    v_submission_id,
    v_access_token,
    v_offer_id,
    v_template_id,
    v_customer_name,
    v_whatsapp,
    v_email,
    v_event_type,
    v_event_date,
    v_host_names,
    v_details,
    offer_row.currency,
    v_subtotal_minor,
    v_discount_minor,
    v_express_minor,
    v_total_minor,
    'awaiting_payment',
    'new'
  )
  returning * into target_order;

  return jsonb_build_object(
    'id', target_order.id,
    'public_id', target_order.public_id,
    'submission_id', target_order.submission_id,
    'access_token', target_order.access_token,
    'offer_id', target_order.offer_id,
    'template_id', target_order.template_id,
    'customer_name', target_order.customer_name,
    'whatsapp', target_order.whatsapp,
    'email', target_order.email,
    'event_type', target_order.event_type,
    'event_date', target_order.event_date,
    'host_names', target_order.host_names,
    'currency', target_order.currency,
    'subtotal_minor', target_order.subtotal_minor,
    'discount_minor', target_order.discount_minor,
    'express_minor', target_order.express_minor,
    'total_minor', target_order.total_minor,
    'payment_status', target_order.payment_status,
    'order_status', target_order.order_status,
    'created_at', target_order.created_at
  );
end;
$$;

-- ============================================================================
-- 3. CUSTOMER CONFIRMATION SLIP LOOKUP (RPC)
-- ============================================================================

create or replace function public.get_order_by_token(token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders%rowtype;
begin
  if token is null or token !~ '^[0-9a-f]{96}$' then
    raise exception 'Order not found';
  end if;

  select * into target
  from public.orders
  where access_token = token;

  if not found then
    raise exception 'Order not found';
  end if;

  -- Record first time customer opened confirmation slip
  update public.orders
  set customer_confirmation_opened_at = coalesce(customer_confirmation_opened_at, now())
  where id = target.id;

  -- Return only customer-safe fields
  return jsonb_build_object(
    'public_id', target.public_id,
    'customer_name', target.customer_name,
    'offer_id', target.offer_id,
    'template_id', target.template_id,
    'event_type', target.event_type,
    'event_date', target.event_date,
    'host_names', target.host_names,
    'currency', target.currency,
    'subtotal_minor', target.subtotal_minor,
    'discount_minor', target.discount_minor,
    'express_minor', target.express_minor,
    'total_minor', target.total_minor,
    'payment_status', target.payment_status,
    'order_status', target.order_status,
    'created_at', target.created_at,
    'details', target.details
  );
end;
$$;

-- ============================================================================
-- 4. ADMIN WORKFLOW FUNCTIONS (RPC)
-- ============================================================================

create or replace function public.set_status(p_order_id uuid, next_status public.order_status)
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

  update public.orders
  set order_status = next_status
  where id = p_order_id
  returning * into target;

  if not found then
    raise exception 'Order not found';
  end if;

  return jsonb_build_object(
    'public_id', target.public_id,
    'order_status', target.order_status
  );
end;
$$;

create or replace function public.add_note(p_order_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_note public.admin_notes%rowtype;
  target_exists boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_body is null or char_length(trim(p_body)) < 1 or char_length(p_body) > 5000 then
    raise exception 'Note body must be between 1 and 5000 characters';
  end if;

  select exists (select 1 from public.orders where id = p_order_id) into target_exists;
  if not target_exists then
    raise exception 'Order not found';
  end if;

  insert into public.admin_notes (order_id, author, body)
  values (p_order_id, auth.uid(), trim(p_body))
  returning * into new_note;

  return jsonb_build_object(
    'id', new_note.id,
    'order_id', p_order_id,
    'created_at', new_note.created_at
  );
end;
$$;

create or replace function public.mark_confirmation_sent(p_order_id uuid)
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

  update public.orders
  set customer_confirmation_sent_at = now()
  where id = p_order_id
  returning * into target;

  if not found then
    raise exception 'Order not found';
  end if;

  insert into public.order_events (order_id, type, actor, actor_user_id)
  values (target.id, 'confirmation_sent', 'admin', auth.uid());

  return jsonb_build_object(
    'public_id', target.public_id,
    'sent_at', target.customer_confirmation_sent_at
  );
end;
$$;

create or replace function public.rotate_access_token(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target public.orders%rowtype;
  new_token text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  new_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  update public.orders
  set access_token = new_token
  where id = p_order_id
  returning * into target;

  if not found then
    raise exception 'Order not found';
  end if;

  insert into public.order_events (order_id, type, actor, actor_user_id)
  values (target.id, 'access_token_rotated', 'admin', auth.uid());

  return jsonb_build_object(
    'public_id', target.public_id,
    'access_token', target.access_token
  );
end;
$$;

-- ============================================================================
-- 5. FUNCTION PERMISSIONS & ROLE GRANTS
-- ============================================================================

-- Restrict all functions by default
revoke all on function public.create_order(jsonb) from public, anon, authenticated;
revoke all on function public.get_order_by_token(text) from public, anon, authenticated;
revoke all on function public.set_status(uuid, public.order_status) from public, anon, authenticated;
revoke all on function public.add_note(uuid, text) from public, anon, authenticated;
revoke all on function public.mark_confirmation_sent(uuid) from public, anon, authenticated;
revoke all on function public.rotate_access_token(uuid) from public, anon, authenticated;

-- Public customer endpoints
grant execute on function public.create_order(jsonb) to anon, authenticated;
grant execute on function public.get_order_by_token(text) to anon, authenticated;

-- Authenticated admin endpoints
grant execute on function public.set_status(uuid, public.order_status) to authenticated;
grant execute on function public.add_note(uuid, text) to authenticated;
grant execute on function public.mark_confirmation_sent(uuid) to authenticated;
grant execute on function public.rotate_access_token(uuid) to authenticated;

-- ============================================================================
-- 6. PRIMARY ADMIN USER SEED
-- ============================================================================

insert into public.admins (user_id)
values ('cbc361dd-e270-4987-921a-021b72830c33')
on conflict (user_id) do nothing;
