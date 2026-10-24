-- Migration 010: Register The Imperial and The Heirloom templates.
-- create_order rejects template ids missing from catalog_templates with
-- "Template not found", so both designs must exist before they are ordered.

insert into public.catalog_templates (
  id, offer_id, label, active
) values
  ('imperial', 'template-invitation', 'The Imperial', true),
  ('heirloom', 'template-invitation', 'The Heirloom', true)
on conflict (id) do update set
  offer_id = excluded.offer_id,
  label = excluded.label,
  active = excluded.active;
