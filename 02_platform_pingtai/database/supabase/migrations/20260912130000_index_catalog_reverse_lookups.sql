begin;

select pg_advisory_xact_lock(hashtext('catalog:reverse-lookup-indexes:v1'));

create index if not exists catalog_sku_product_lookup
  on catalog.sku(product_id,id);

create index if not exists catalog_listing_sku_scope_lookup
  on catalog.listing(sku_id,scope_id);

create index if not exists catalog_source_listing_sku_scope_lookup
  on catalog.sourcelisting(sku_id,scope_id)
  where sku_id is not null;

commit;
