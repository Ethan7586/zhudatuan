begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260831022000') then
    raise exception 'CATALOG_PRODUCT_OWNER_SCOPE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260831023000') then
    raise exception 'CATALOG_PRODUCT_OWNER_SCOPE_ALREADY_APPLIED';
  end if;
end $precondition$;

alter table catalog.product add column scope_id text;
update catalog.product product set scope_id=coalesce(
  product.owner_partner_id,
  (select listing.scope_id from catalog.sku sku join catalog.listing listing on listing.sku_id=sku.id
    where sku.product_id=product.id order by listing.scope_id,listing.id limit 1),
  'organization-platform-root'
);
alter table catalog.product alter column scope_id set not null;
create index catalog_product_scope on catalog.product(scope_id,status,updated_at,id);

select runtime.record_migration_evidence('20260831023000',1,1,0,0,
  'select id,scope_id,status,version from catalog.product order by id;',
  'select version,checksum from runtime.schemaversion where version=''20260831023000'';');
insert into runtime.schemaversion(version,checksum)
values('20260831023000','3d12c1e458331aec341ae37f0ace2bf6461b253a71d5c87ff01da3c2385483af');

do $assert$ begin
  if exists(select 1 from catalog.product where scope_id is null) then
    raise exception 'CATALOG_PRODUCT_OWNER_SCOPE_MISSING';
  end if;
end $assert$;

commit;
