-- Migration 013: Flat Rs 2,000 invitation price, no discount.
-- create_order prices every order from catalog_offers, so the storefront quote
-- in config.js (listPrice 8 USD x PKR rate 250) only matches the saved order
-- total once this row is updated. Amounts stay in USD minor units.

update public.catalog_offers
set list_price_minor = 800,
    discount_percent = 0,
    discount_ends_at = null,
    updated_at = now()
where id = 'template-invitation';