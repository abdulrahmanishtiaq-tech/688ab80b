-- Migration 008: Register The Royal Garden template.
-- create_order rejects template ids missing from catalog_templates with
-- "Template not found", so the second design must exist before it is ordered.

insert into public.catalog_templates (
  id, offer_id, label, active
) values (
  'royal-garden',
  'template-invitation',
  'The Royal Garden',
  true
)
on conflict (id) do update set
  offer_id = excluded.offer_id,
  label = excluded.label,
  active = excluded.active;
