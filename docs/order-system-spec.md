# Order management system: spec

## Goal

Add persistent orders, a private admin dashboard, an order confirmation slip, manual WhatsApp workflows (click-to-chat, no paid API) and manual payment verification to the existing static site. Do NOT redesign the site. Reuse the existing tokens, components, fonts, and the .github/copilot-instructions.md rules. No frameworks, no build tools. Plain HTML, CSS and JavaScript with classic <script> tags and the window.DI namespace.

## Existing facts (verify by inspecting the repo, never assume)

Static site, no backend today. The order dialog (order.js) has 3 steps and builds a WhatsApp message on "Place order". There is an offer called "Template Invitation" (choose an existing template, currently The Vow Atelier). I believe there is a second offer; find it in the code and report what it is. Prices and copy live in config.js, calculated by pricing.js.

## Architecture: Supabase (Postgres + Auth + Row Level Security + SQL functions)

- The client uses @supabase/supabase-js v2 loaded from jsDelivr, pinned to an exact version. Create supabase-client.js to wrap it. Only the project URL and anon key go in config.js. NEVER put a service_role key, secrets or passwords in any file in the repo.
- All SQL lives in supabase/migrations/\*.sql (numbered), idempotent where possible, with comments. Include seed SQL for the catalog and a docs/SETUP.md with each manual step.
- Customers never read or write tables directly. Orders are created and fetched only through SECURITY DEFINER functions (set search_path = '') that validate input. Table RLS grants access to admins only.

## Data model (columns are a minimum; adapt names to the repo)

- admins(user_id uuid primary key references auth.users, created_at). Function is_admin() returns true if auth.uid() is in admins.
- catalog_offers(id, label, active, list_price_minor int, currency, discount_percent, discount_ends_at nullable, express_price_minor) and catalog_templates(id, offer_id, label, active). Prices are integers in minor units. The catalog is the trusted price source.
- orders(id uuid pk, public_id text unique (INV-YYYY-00001), submission_id uuid unique (idempotency), access_token text unique (random, 48 hex chars), offer_id, template_id, customer_name, whatsapp (E.164 digits), email nullable, event_type, event_date nullable, host_names, details jsonb (the full validated form answers), currency, subtotal_minor, discount_minor, express_minor, total_minor, payment_status, order_status, customer_confirmation_opened_at, customer_confirmation_sent_at, created_at, updated_at).
- order_events (append-only history): id, order_id, type, from_value, to_value, actor (customer, admin id or system), created_at. No update or delete policies. A trigger writes status changes automatically.
- payments(id, order_id, method (bank_transfer, easypaisa, jazzcash, other), amount_minor, currency, reference, status (submitted, verified, rejected), submitted_at, verified_by, verified_at, note).
- admin_notes(id, order_id, author, body, created_at). Customers can never read this table.
- order_counters(year, last_number) used by the order-ID function inside the same transaction (atomic, no duplicates).

## Statuses (two separate fields)

- payment_status: awaiting_payment, payment_submitted, paid, partially_paid, refunded.
- order_status (production): new, in_progress, awaiting_customer_approval, completed, cancelled.
  Dashboard labels may combine them, but the data stays separate. An order can be paid and still new.

## Database functions (RPC)

- create_order(payload jsonb): validate lengths, formats and required fields (reject unknown keys), recompute every price from the catalog (ignore any client amounts), apply the discount only if active and not ended, enforce a simple rate limit (max 5 orders per WhatsApp number per hour), return the existing order when the same submission_id is sent again, and return {public_id, access_token, total_minor, currency, ...}.
- get_order_by_token(token text): returns only customer-safe fields (never admin notes, internal ids, other customers' data). Constant-time friendly: look up by the token column only.
- submit_payment_reference(token, method, reference): inserts a payment with status submitted and sets payment_status to payment_submitted. It can NEVER set paid.
- is_admin(). Admin changes go through RLS-protected table updates or admin-only functions (verify_payment, set_status, add_note, mark_confirmation_sent, rotate_access_token, admin_delete_completed_order) that all check is_admin() themselves. Only completed orders can be deleted; payments, notes and events cascade with the order.

## Customer flow

Place order -> disable the button and show a loading state -> call create_order -> only on success show the success panel (public_id, total, Confirmation link, "Send Order on WhatsApp" button, "Back to site"). On failure show a clear message and keep the form data. Offer a clearly labelled fallback "Send my details on WhatsApp instead (this order will NOT be saved)". Never open WhatsApp before the order is saved. The draft keeps the submission_id until success.

## Confirmation page (confirmation.html)

URL: confirmation.html?t=<access_token>. Loads data only through get_order_by_token. Shows business name and logo (from config), order ID, dates, customer name, offer and template, key event details, itemised pricing, total, payment status, a "what happens next" message, business contact. Print stylesheet for a clean A4 slip, a "Download PDF" button that triggers window.print() with the instruction to choose Save as PDF, a "Send Order on WhatsApp" button, a "Copy link" button, and a route back to the site. meta noindex, Referrer-Policy no-referrer. Retry buttons if a load fails.

## WhatsApp rules (click-to-chat only)

Central config: DI.site.phone (digits, international). A function normalizeWhatsApp(raw) strips non-digits and leading 00 and flags numbers that are not 7 to 15 digits. Customer button: opens wa.me/<business>?text=<encoded> with order ID, customer name, offer, template, event date, total and the slip URL, all from SAVED data. Admin "Confirm via WhatsApp": opens wa.me/<customer>?text=<encoded> with a friendly message using saved values; omit lines that do not apply; use the order's currency, never a hard-coded one. Separate actions: "Open WhatsApp chat" (general follow-up) and "Mark confirmation as sent" (admin clicks it after sending, stores the timestamp). Record "chat opened" as an event and label it "opened, not confirmed sent". No automation, no unofficial APIs, no message is ever described as delivered.

## Admin dashboard (admin.html, admin.js, admin.css; not linked from the public site; noindex)

- Supabase email and password login, logout, session check and is_admin() check on load. Real protection comes from RLS, not from hiding the page.
- Overview cards computed from real rows: total orders, new, awaiting payment, paid, in progress, completed, confirmed revenue (sum of verified payments).
- Orders table: search (order ID, name, WhatsApp), filters (order status, payment status, offer, date range), sorting, pagination (25 per page, server-side), a column set matching the owner's list. Orders from the same customer are linked by WhatsApp number in a "previous orders" list on the detail view but never merged.
- Order detail: all saved fields, template preview/thumbnail, pricing breakdown, payment panel, status controls, history timeline, internal notes, WhatsApp actions.
- Payments: method, amount due, amount received, reference, "Verify payment" (admin only, with note and timestamp), partial payments supported.

## Security rules (must hold)

Never trust client prices, statuses or admin flags. RLS enabled on every table, no anon policies on any table. Constrain every RPC input. Rate limit order creation. Escape all user text when rendering (textContent, never innerHTML). Do not log tokens or personal data. Keep tokens out of analytics. Sign-ups disabled. Document how to rotate keys.

## Future-proofing

Keep functions small and separated (orders-api.js, whatsapp.js, slip.js, admin-\*.js) so WhatsApp Business API, online payments, email, order tracking and reminders can be added later without rewriting the order model.
