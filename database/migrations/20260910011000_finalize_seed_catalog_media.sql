begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260910010000') then
    raise exception 'SEED_CATALOG_MEDIA_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260910011000') then
    raise exception 'SEED_CATALOG_MEDIA_ALREADY_APPLIED';
  end if;
end
$precondition$;

create temporary table seedcatalogmedia(
  product_id text primary key,
  cover_url text not null check(cover_url~'^https://')
) on commit drop;

insert into seedcatalogmedia(product_id,cover_url) values
  ('product-rice','https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80'),
  ('product-movie','https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&auto=format&fit=crop&q=80');

create temporary table seedcatalogmediabaseline on commit drop as
select count(*)::bigint product_count
from catalog.product product
join seedcatalogmedia source on source.product_id=product.id;

update catalog.product product
set attributes=jsonb_set(coalesce(product.attributes,'{}'::jsonb),'{coverUrl}',to_jsonb(source.cover_url),true),
  version=product.version+1,
  updated_at=clock_timestamp()
from seedcatalogmedia source
where product.id=source.product_id
  and nullif(product.attributes->>'coverObject','') is null
  and nullif(product.attributes->>'coverUrl','') is null;

select runtime.record_migration_evidence(
  '20260910011000',
  (select product_count from seedcatalogmediabaseline),
  (select count(*) from catalog.product product join seedcatalogmedia source on source.product_id=product.id),
  0,
  0,
  'select product.id,product.title,product.attributes->>''coverObject'' cover_object,product.attributes->>''coverUrl'' cover_url from catalog.product product where product.id in(''product-rice'',''product-movie'') order by product.id;',
  'select product.id from catalog.product product where product.id in(''product-rice'',''product-movie'') and nullif(product.attributes->>''coverObject'','''') is null and nullif(product.attributes->>''coverUrl'','''') is null order by product.id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260910011000',encode(public.digest('20260910011000_finalize_seed_catalog_media','sha256'),'hex'));

update runtime.schemahead set
  migration_head='20260910011000',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:catalog',
  published_at=clock_timestamp()
where artifact='commerce';

do $assert$
begin
  if (select product_count from seedcatalogmediabaseline)<>(
    select count(*) from catalog.product product join seedcatalogmedia source on source.product_id=product.id
  ) then raise exception 'SEED_CATALOG_MEDIA_PRODUCT_COUNT_CHANGED'; end if;
  if exists(
    select 1 from catalog.product product join seedcatalogmedia source on source.product_id=product.id
    where nullif(product.attributes->>'coverObject','') is null
      and nullif(product.attributes->>'coverUrl','') is null
  ) then raise exception 'SEED_CATALOG_MEDIA_INCOMPLETE'; end if;
  if exists(
    select 1 from catalog.product product join seedcatalogmedia source on source.product_id=product.id
    where nullif(product.attributes->>'coverObject','') is null
      and product.attributes->>'coverUrl'!~'^https://'
  ) then raise exception 'SEED_CATALOG_MEDIA_URL_INVALID'; end if;
  if not exists(
    select 1 from runtime.schemahead
    where artifact='commerce' and migration_head='20260910011000'
      and migration_count=(select count(*) from runtime.schemaversion)
  ) then raise exception 'SEED_CATALOG_MEDIA_SCHEMA_HEAD_INVALID'; end if;
end
$assert$;

commit;
