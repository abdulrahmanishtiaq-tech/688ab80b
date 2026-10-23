-- Core tables. Prices are integer minor units; the database is the source of truth.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.catalog_offers (
  id text primary key,
  label text not null,
  active boolean not null default true,
  list_price_minor integer not null check (list_price_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  discount_percent numeric(5,2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  discount_ends_at timestamptz,
  express_price_minor integer not null default 0 check (express_price_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_templates (
  id text primary key,
  offer_id text not null references public.catalog_offers(id),
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_counters (
  year integer primary key check (year between 2000 and 9999),
  last_number integer not null default 0 check (last_number >= 0)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  submission_id uuid not null unique,
  access_token text not null unique check (access_token ~ '^[0-9a-f]{96}$'),
  offer_id text not null references public.catalog_offers(id),
  template_id text not null references public.catalog_templates(id),
  customer_name text not null,
  whatsapp text not null check (whatsapp ~ '^[0-9]{7,15}$'),
  email text,
  event_type text,
  event_date date,
  host_names text not null,
  details jsonb not null default '{}'::jsonb,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor integer not null check (subtotal_minor >= 0),
  discount_minor integer not null default 0 check (discount_minor >= 0),
  express_minor integer not null default 0 check (express_minor >= 0),
  total_minor integer not null check (total_minor >= 0),
  payment_status public.payment_status not null default 'awaiting_payment',
  order_status public.order_status not null default 'new',
  customer_confirmation_opened_at timestamptz,
  customer_confirmation_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null,
  from_value text,
  to_value text,
  actor public.order_event_actor not null,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method public.payment_method not null,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reference text not null check (char_length(reference) between 1 and 160),
  status public.payment_record_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  note text
);

create table if not exists public.admin_notes (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  author uuid not null references auth.users(id),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists catalog_templates_offer_idx on public.catalog_templates(offer_id);
create index if not exists orders_whatsapp_idx on public.orders(whatsapp);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_statuses_idx on public.orders(order_status, payment_status);
create index if not exists order_events_order_created_idx on public.order_events(order_id, created_at desc);
create index if not exists payments_order_idx on public.payments(order_id, submitted_at desc);
create index if not exists admin_notes_order_idx on public.admin_notes(order_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists catalog_offers_set_updated_at on public.catalog_offers;
create trigger catalog_offers_set_updated_at before update on public.catalog_offers
for each row execute function public.set_updated_at();

drop trigger if exists catalog_templates_set_updated_at on public.catalog_templates;
create trigger catalog_templates_set_updated_at before update on public.catalog_templates
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.record_order_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events(order_id, type, to_value, actor)
    values (new.id, 'order_status_changed', new.order_status::text, 'system');
  elsif old.order_status is distinct from new.order_status then
    insert into public.order_events(order_id, type, from_value, to_value, actor, actor_user_id)
    values (new.id, 'order_status_changed', old.order_status::text, new.order_status::text,
      case when auth.uid() is null then 'system'::public.order_event_actor else 'admin'::public.order_event_actor end,
      auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists orders_record_status_change on public.orders;
create trigger orders_record_status_change after insert or update of order_status on public.orders
for each row execute function public.record_order_status_change();

alter table public.admins enable row level security;
alter table public.catalog_offers enable row level security;
alter table public.catalog_templates enable row level security;
alter table public.order_counters enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.payments enable row level security;
alter table public.admin_notes enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

drop policy if exists admins_admin_only on public.admins;
create policy admins_admin_only on public.admins for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists catalog_offers_admin_only on public.catalog_offers;
create policy catalog_offers_admin_only on public.catalog_offers for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists catalog_templates_admin_only on public.catalog_templates;
create policy catalog_templates_admin_only on public.catalog_templates for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_counters_admin_only on public.order_counters;
create policy order_counters_admin_only on public.order_counters for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists orders_admin_only on public.orders;
create policy orders_admin_only on public.orders for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_events_admin_only on public.order_events;
create policy order_events_admin_only on public.order_events for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists payments_admin_only on public.payments;
create policy payments_admin_only on public.payments for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists admin_notes_admin_only on public.admin_notes;
create policy admin_notes_admin_only on public.admin_notes for all to authenticated
using (public.is_admin()) with check (public.is_admin());
