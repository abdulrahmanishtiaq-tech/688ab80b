# Supabase order-system setup

This document covers the Supabase database, customer order flow, confirmation slip, and private admin dashboard.

## Checklist

- [ ] Create or select the Supabase project.
- [ ] Confirm the project URL is `https://qikmfljhuglxmqqkiohp.supabase.co`.
- [ ] Keep the publishable anon key separate from service-role credentials.
- [ ] Run migrations in numeric order.
- [ ] Deploy the site with the security headers from `_headers`.
- [ ] Add the first admin Auth user.
- [ ] Insert that Auth user's UUID into `public.admins`.
- [ ] Disable public sign-ups.
- [ ] Set the Supabase Site URL.
- [ ] Review the seeded catalog and prices.
- [ ] Run `supabase/tests/security.sql`.
- [ ] Export a backup before production catalog or status changes.

## Create the project

1. Open the Supabase dashboard.
2. Create a project, or select the existing project:
   `https://qikmfljhuglxmqqkiohp.supabase.co`
3. In **Project Settings > API**, copy only the project URL and publishable anon key for the later client phase.
4. Never put a `service_role` key in this repository or in browser code.

## Run migrations

Open **SQL Editor**, create a new query, and run these files separately in order:

1. `supabase/migrations/001_extensions_enums.sql`
2. `supabase/migrations/002_tables_rls.sql`
3. `supabase/migrations/003_functions_seed_grants.sql`
4. `supabase/migrations/004_admin_overview.sql`
5. `supabase/migrations/005_admin_payment_status.sql`
6. `supabase/migrations/006_payment_submission_integrity.sql`
7. `supabase/migrations/007_order_workflow_steps.sql`
8. `supabase/migrations/008_catalog_royal_garden.sql`
9. `supabase/migrations/009_admin_delete_completed_order.sql`
10. `supabase/migrations/010_catalog_imperial_heirloom.sql`
11. `supabase/migrations/011_catalog_beyond_stars.sql`

Run the migrations in the Supabase SQL editor in order. Migration 009 adds the admin-only permanent delete for completed orders.

Running them in order matters because the later migrations depend on types, tables, triggers, and helper functions from the earlier files. Do not skip a numbered migration.

## Add an admin user

1. In **Authentication > Users**, create the first admin user with email and password.
2. Copy that user's UUID.
3. In SQL Editor, run:

```sql
insert into public.admins(user_id)
values ('cbc361dd-e270-4987-921a-021b72830c33');
```

Only add trusted staff users. The `admins` table is protected by RLS, and admin functions independently call `public.is_admin()`.

## Disable sign-ups

In **Authentication > Providers > Email**, disable public email sign-ups. Existing admins can still sign in. Do not expose an admin invite or service credential in the public site.

## Set the Site URL

In **Authentication > URL Configuration**:

- Set **Site URL** to the production website origin, for example:
  `https://your-domain.example`
- Add the local Live Server origin to **Redirect URLs** while testing, for example:
  `http://127.0.0.1:5500/**`

Use the real production origin before enabling customer-facing Auth or confirmation links.

## Configuration for the later client phase

The later frontend phase will load the pinned Supabase JavaScript client and use:

- Project URL: `https://qikmfljhuglxmqqkiohp.supabase.co`
- Publishable anon key: supplied through the agreed deployment/configuration method

Only the URL and anon key belong in browser configuration. Database security must continue to rely on RLS and function checks.

## Deploy the frontend securely

1. Put the publishable anon key in `config.js` only through your deployment configuration process. Never add a service-role key.
2. Deploy `_headers` with the static site on hosts that support Netlify-style headers. On other hosts, add equivalent response headers in the host dashboard.
3. Confirm `admin.html` and `confirmation.html` are served over HTTPS.
4. Keep `confirmation.html?t=...` links private; do not place them in analytics, logs, screenshots, or public support tickets.

## Key rotation

If the publishable key is exposed outside the intended site, create a replacement in Supabase **Project Settings > API**, update the deployment configuration, redeploy, and remove the old key from cached or committed files. A publishable anon key is protected by RLS, but rotate it promptly if exposure is unexpected. Never rotate by placing a service-role key in the browser.

## Backups

Before production changes, use the Supabase dashboard or Supabase CLI to export a private backup of the database, including schema and data. Record its timestamp and periodically test restoration in a separate project. Do not commit exports, customer details, access tokens, or payment records.

## Seeded catalog

The seed is derived from the current [config.js](../config.js):

- Offer: `Template Invitation`
- Offer ID: `template-invitation`
- Currency: USD
- List price: 4000 minor units (`$40`)
- Discount: 50% with no expiry
- Express: 500 minor units (`$5`)
- Template: `The Vow Atelier`
- Template ID: `vow-atelier`
- Template: `The Royal Garden`
- Template ID: `royal-garden`
- Template: `The Imperial`
- Template ID: `imperial`
- Template: `The Heirloom`
- Template ID: `heirloom`
- Template: `Beyond Stars`
- Template ID: `beyond-stars`

Migration 003 only seeds `vow-atelier`; migration 008 seeds `royal-garden`; migration 010 seeds `imperial` and `heirloom`; migration 011 seeds `beyond-stars`. Apply those migrations to any existing database before taking orders for those designs, otherwise `create_order` rejects the order with `Template not found`:

```sql
insert into public.catalog_templates (id, offer_id, label, active)
values
  ('royal-garden', 'template-invitation', 'The Royal Garden', true),
  ('imperial', 'template-invitation', 'The Imperial', true),
  ('heirloom', 'template-invitation', 'The Heirloom', true),
  ('beyond-stars', 'template-invitation', 'Beyond Stars', true)
on conflict (id) do update set
  offer_id = excluded.offer_id,
  label = excluded.label,
  active = excluded.active;
```

The legacy extras and bundles remain outside the active database catalog.

## Security test checks

Run `supabase/tests/security.sql` after migrations. Some checks are executable examples rather than one-click assertions because repeated submissions and rate-limit tests require disposable UUIDs and phone numbers. Run those in a test project and clean up test orders afterward.

## Before Phase 2

- Confirm all migrations completed without errors.
- Confirm the first admin can be inserted and `select public.is_admin()` returns true in that authenticated session.
- Confirm anonymous direct table reads are denied.
- Confirm `create_order` returns a server-generated `INV-YYYY-00001` ID.
- Confirm the returned standard total is 2000 minor units and Express is 2500 minor units while the discount is active.
- Confirm the publishable anon key delivery method.
- Confirm a current private Supabase export exists before launch.
