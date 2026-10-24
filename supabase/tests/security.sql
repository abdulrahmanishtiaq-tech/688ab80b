-- Run this in the Supabase SQL editor after the migrations.
-- The role-switch checks require a privileged SQL editor session.

-- 1. Anonymous table reads must be denied. This block succeeds only when every
-- direct table read raises insufficient_privilege.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['admins', 'catalog_offers', 'catalog_templates', 'order_counters', 'orders', 'payments', 'order_events', 'admin_notes'] loop
    begin
      set local role anon;
      execute format('select 1 from public.%I limit 1', table_name);
      raise exception 'anon can select from public.%', table_name;
    exception when insufficient_privilege then
      null;
    end;
    reset role;
  end loop;
end $$;

-- Customers cannot set a paid status. This RPC is callable only by authenticated
-- admins and the customer payment RPC rejects terminal orders; verify_payment is
-- the only function that can derive paid from verified payment totals.
select 'paid_requires_admin_verification' as check_name,
  has_function_privilege('anon', 'public.verify_payment(uuid, text)', 'execute') = false
  and has_function_privilege('anon', 'public.set_payment_status(uuid, public.payment_status)', 'execute') = false
  as passed;

-- Anonymous direct writes to status and catalog price must be denied.
do $$
begin
  begin
    set local role anon;
    execute 'update public.orders set order_status = ''completed'' where false';
    raise exception 'anon can change order status';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    set local role anon;
    execute 'update public.catalog_offers set list_price_minor = 1 where id = ''template-invitation''';
    raise exception 'anon can change catalog price';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- 3b. Replaying a payment reference returns the same payment and does not
-- insert a duplicate row. The terminal-state branch must reject later replay.
do $$
declare
  submission uuid := gen_random_uuid();
  payload jsonb := jsonb_build_object(
    'submission_id', submission, 'offer_id', 'template-invitation', 'template_id', 'vow-atelier',
    'customer', jsonb_build_object('full_name', 'Payment Idempotency Test', 'whatsapp', '923000000005'),
    'invitation', jsonb_build_object('groom_name', 'A', 'bride_name', 'B'),
    'delivery', jsonb_build_object('express', false), 'consent', true
  );
  created jsonb;
  first_payment jsonb;
  second_payment jsonb;
  payment_count integer;
begin
  created := public.create_order(payload);
  first_payment := public.submit_payment_reference(created->>'access_token', 'other', 'SECURITY-REF-1', 100);
  second_payment := public.submit_payment_reference(created->>'access_token', 'other', 'SECURITY-REF-1', 100);
  select count(*) into payment_count from public.payments where order_id = (
    select id from public.orders where submission_id = submission
  );
  if payment_count <> 1 or second_payment->>'payment_id' <> first_payment->>'payment_id' then
    raise exception 'payment reference replay was not idempotent';
  end if;
  delete from public.orders where submission_id = submission;
end $$;

-- 2. Client price fields are not accepted as authoritative. The returned total is
-- based on the seeded catalog, not any client-supplied price keys.
select 'client_price_ignored' as check_name,
  (public.create_order(jsonb_build_object(
    'submission_id', gen_random_uuid(), 'offer_id', 'template-invitation', 'template_id', 'vow-atelier',
    'customer', jsonb_build_object('full_name', 'Security Test', 'whatsapp', '923000000001'),
    'invitation', jsonb_build_object('groom_name', 'A', 'bride_name', 'B'),
    'delivery', jsonb_build_object('express', false), 'consent', true,
    'client_quote', jsonb_build_object('list_price_minor', 1, 'total_minor', 1)
  ))->>'total_minor')::integer = 2000 as passed;

-- 3. Repeated submission_id returns the same order. This creates one disposable
-- order and removes it at the end; run in a test project or inside a transaction.
do $$
declare
  submission uuid := gen_random_uuid();
  payload jsonb := jsonb_build_object(
    'submission_id', submission, 'offer_id', 'template-invitation', 'template_id', 'vow-atelier',
    'customer', jsonb_build_object('full_name', 'Idempotency Test', 'whatsapp', '923000000002'),
    'invitation', jsonb_build_object('groom_name', 'A', 'bride_name', 'B'),
    'delivery', jsonb_build_object('express', false), 'consent', true
  );
  first_result jsonb;
  second_result jsonb;
begin
  first_result := public.create_order(payload);
  second_result := public.create_order(payload);
  if first_result->>'public_id' <> second_result->>'public_id' then
    raise exception 'submission_id was not idempotent';
  end if;
  delete from public.orders where submission_id = submission;
end $$;

-- 4. The sixth order for one number in an hour must fail.
do $$
declare
  i integer;
  failed boolean := false;
  phone text := '923000000003';
  submission uuid;
begin
  for i in 1..5 loop
    submission := gen_random_uuid();
    perform public.create_order(jsonb_build_object(
      'submission_id', submission, 'offer_id', 'template-invitation', 'template_id', 'vow-atelier',
      'customer', jsonb_build_object('full_name', 'Rate Test', 'whatsapp', phone),
      'invitation', jsonb_build_object('groom_name', 'A', 'bride_name', 'B'),
      'delivery', jsonb_build_object('express', false), 'consent', true
    ));
  end loop;
  begin
    perform public.create_order(jsonb_build_object(
      'submission_id', gen_random_uuid(), 'offer_id', 'template-invitation', 'template_id', 'vow-atelier',
      'customer', jsonb_build_object('full_name', 'Rate Test', 'whatsapp', phone),
      'invitation', jsonb_build_object('groom_name', 'A', 'bride_name', 'B'),
      'delivery', jsonb_build_object('express', false), 'consent', true
    ));
  exception when others then
    failed := sqlerrm = 'Order rate limit exceeded';
  end;
  delete from public.orders where whatsapp = phone;
  if not failed then raise exception 'rate limit did not trigger'; end if;
end $$;

-- 5. An expired discount must not be applied. The catalog row is restored even
-- if the assertion fails.
do $$
declare
  old_end timestamptz;
  result jsonb;
begin
  select discount_ends_at into old_end from public.catalog_offers where id = 'template-invitation';
  update public.catalog_offers set discount_ends_at = now() - interval '1 minute' where id = 'template-invitation';
  result := public.create_order(jsonb_build_object(
    'submission_id', gen_random_uuid(), 'offer_id', 'template-invitation', 'template_id', 'vow-atelier',
    'customer', jsonb_build_object('full_name', 'Discount Test', 'whatsapp', '923000000004'),
    'invitation', jsonb_build_object('groom_name', 'A', 'bride_name', 'B'),
    'delivery', jsonb_build_object('express', false), 'consent', true
  ));
  update public.catalog_offers set discount_ends_at = old_end where id = 'template-invitation';
  if result->>'total_minor' <> '4000' then raise exception 'expired discount was applied'; end if;
  delete from public.orders where whatsapp = '923000000004';
exception when others then
  update public.catalog_offers set discount_ends_at = old_end where id = 'template-invitation';
  raise;
end $$;
-- 6. Workflow functions must not be executable by anonymous users.
select 'workflow_functions_anon_denied' as check_name,
  has_function_privilege('anon', 'public.admin_complete_step(uuid, integer)', 'execute') = false
  and has_function_privilege('anon', 'public.admin_undo_step(uuid)', 'execute') = false
  and has_function_privilege('anon', 'public.admin_set_link(uuid, text, text)', 'execute') = false
  and has_function_privilege('anon', 'public.admin_set_tid(uuid, text)', 'execute') = false
  and has_function_privilege('anon', 'public.admin_record_step_whatsapp(uuid, integer)', 'execute') = false
  and has_function_privilege('anon', 'public.admin_delete_completed_order(uuid)', 'execute') = false
  as passed;

-- 7. Workflow step rules, skipping prevention, http check, and idempotency
do $$
declare
  submission uuid := gen_random_uuid();
  payload jsonb := jsonb_build_object(
    'submission_id', submission, 'offer_id', 'template-invitation', 'template_id', 'vow-atelier',
    'customer', jsonb_build_object('full_name', 'Workflow Test', 'whatsapp', '923000000006'),
    'invitation', jsonb_build_object('groom_name', 'A', 'bride_name', 'B', 'details', jsonb_build_object('payment', jsonb_build_object('tid', 'TID-SEC-001'))),
    'delivery', jsonb_build_object('express', false), 'consent', true
  );
  created jsonb;
  test_order_id uuid;
  failed boolean;
  step_result jsonb;
begin
  created := public.create_order(payload);
  select id into test_order_id from public.orders where submission_id = submission;

  -- 7a. Non-admin execution must fail with Admin access required
  begin
    set local role authenticated;
    perform public.admin_complete_step(test_order_id, 1);
    raise exception 'non-admin could complete step';
  exception when others then
    if sqlerrm not like '%Admin access required%' and sqlerrm not like '%permission denied%' then
      raise;
    end if;
  end;
  reset role;

  -- 7b. Skipping steps: Step 2 directly when workflow_step is 0 must fail
  failed := false;
  begin
    perform public.admin_complete_step(test_order_id, 2);
  exception when others then
    failed := sqlerrm like '%Cannot skip workflow steps%';
  end;
  if not failed then raise exception 'step skipping was allowed'; end if;

  -- 7c. http:// link must be rejected by admin_set_link
  failed := false;
  begin
    perform public.admin_set_link(test_order_id, 'preview', 'http://insecure-link.com/preview');
  exception when others then
    failed := sqlerrm like '%Link must be a valid https URL%';
  end;
  if not failed then raise exception 'http:// link was accepted'; end if;

  -- 7d. Step 1 completion and repeated call idempotency
  step_result := public.admin_complete_step(test_order_id, 1);
  if (step_result->>'workflow_step')::int <> 1 then raise exception 'step 1 failed'; end if;

  step_result := public.admin_complete_step(test_order_id, 1);
  if (step_result->>'already_completed')::boolean <> true then raise exception 'repeated step 1 call was not marked already_completed'; end if;

  -- 7e. Step 2 completion
  step_result := public.admin_complete_step(test_order_id, 2);
  if (step_result->>'workflow_step')::int <> 2 then raise exception 'step 2 failed'; end if;

  -- 7f. Step 3 must fail without a preview link
  failed := false;
  begin
    perform public.admin_complete_step(test_order_id, 3);
  exception when others then
    failed := sqlerrm like '%Step 3 requires a saved preview link%';
  end;
  if not failed then raise exception 'step 3 succeeded without preview link'; end if;

  -- Set valid preview link and complete step 3
  perform public.admin_set_link(test_order_id, 'preview', 'https://example.com/preview-1');
  step_result := public.admin_complete_step(test_order_id, 3);
  if (step_result->>'workflow_step')::int <> 3 then raise exception 'step 3 completion failed'; end if;

  -- 7g. Undo step 3 only affects latest step (reverts to step 2)
  step_result := public.admin_undo_step(test_order_id);
  if (step_result->>'workflow_step')::int <> 2 then raise exception 'undo step 3 failed'; end if;

  -- Cleanup disposable test order
  delete from public.orders where id = test_order_id;
end $$;
