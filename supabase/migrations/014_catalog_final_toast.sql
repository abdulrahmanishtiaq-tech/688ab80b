-- Migration 014: Register The Final Toast template.
-- create_order rejects template ids missing from catalog_templates with
-- "Template not found", so the design must exist before it is ordered.

insert into public.catalog_templates (
  id,
  offer_id,
  label,
  active
) values (
  'final-toast',
  'template-invitation',
  'The Final Toast',
  true
)
on conflict (id) do update set
  offer_id = excluded.offer_id,
  label = excluded.label,
  active = excluded.active,
  updated_at = now();
