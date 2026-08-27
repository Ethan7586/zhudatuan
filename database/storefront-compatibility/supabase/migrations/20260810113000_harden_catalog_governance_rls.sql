-- Catalog governance tables are internal operational data. Browser roles must
-- not access or truncate them directly; future access is exposed only through
-- reviewed security-definer RPCs owned by commerce-api.

alter table public.catalog_classification_rules enable row level security;
alter table public.catalog_review_queue enable row level security;
alter table public.catalog_supplier_category_mappings enable row level security;
alter table public.catalog_taxonomy_nodes enable row level security;

revoke all on table public.catalog_classification_rules from anon, authenticated;
revoke all on table public.catalog_review_queue from anon, authenticated;
revoke all on table public.catalog_supplier_category_mappings from anon, authenticated;
revoke all on table public.catalog_taxonomy_nodes from anon, authenticated;
