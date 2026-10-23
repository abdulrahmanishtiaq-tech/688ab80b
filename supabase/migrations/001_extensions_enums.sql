-- Extensions and controlled values used by the order system.
create extension if not exists pgcrypto;

do $$ begin
  create type public.payment_status as enum (
    'awaiting_payment', 'payment_submitted', 'paid', 'partially_paid', 'refunded'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_status as enum (
    'new', 'in_progress', 'awaiting_customer_approval', 'completed', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum (
    'bank_transfer', 'easypaisa', 'jazzcash', 'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_record_status as enum (
    'submitted', 'verified', 'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_event_actor as enum (
    'customer', 'admin', 'system'
  );
exception when duplicate_object then null;
end $$;
