begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260909018000') then
    raise exception 'CATALOG_MEDIA_RESTORE_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260910010000') then
    raise exception 'CATALOG_MEDIA_RESTORE_ALREADY_APPLIED';
  end if;
end
$precondition$;

create temporary table catalogmediarestore(
  product_id text primary key,
  cover_url text not null check(cover_url~'^https://')
) on commit drop;

insert into catalogmediarestore(product_id,cover_url) values
  ('p_101','https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80'),
  ('p_102','https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80'),
  ('p_103','https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600&auto=format&fit=crop&q=80'),
  ('p_104','https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80'),
  ('p_201','https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&auto=format&fit=crop&q=80'),
  ('p_202','https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80'),
  ('p_301','https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80'),
  ('p_701','https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&auto=format&fit=crop&q=80');

create temporary table catalogmediabaseline on commit drop as
select count(*)::bigint product_count
from catalog.product product
join catalogmediarestore source on source.product_id=product.id;

update catalog.product product
set attributes=jsonb_set(coalesce(product.attributes,'{}'::jsonb),'{coverUrl}',to_jsonb(source.cover_url),true),
  version=product.version+1,
  updated_at=clock_timestamp()
from catalogmediarestore source
where product.id=source.product_id
  and nullif(product.attributes->>'coverObject','') is null
  and nullif(product.attributes->>'coverUrl','') is null;

select runtime.record_migration_evidence(
  '20260910010000',
  (select product_count from catalogmediabaseline),
  (select count(*) from catalog.product product join catalogmediarestore source on source.product_id=product.id),
  0,
  0,
  'select product.id,product.title,product.attributes->>''coverObject'' cover_object,product.attributes->>''coverUrl'' cover_url from catalog.product product where product.id in(''p_101'',''p_102'',''p_103'',''p_104'',''p_201'',''p_202'',''p_301'',''p_701'') order by product.id;',
  'select product.id from catalog.product product where product.id in(''p_101'',''p_102'',''p_103'',''p_104'',''p_201'',''p_202'',''p_301'',''p_701'') and nullif(product.attributes->>''coverObject'','''') is null and nullif(product.attributes->>''coverUrl'','''') is null order by product.id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260910010000',encode(public.digest('20260910010000_finalize_catalog_media','sha256'),'hex'));

update runtime.schemahead set
  migration_head='20260910010000',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:catalog',
  published_at=clock_timestamp()
where artifact='commerce';

do $assert$
begin
  if (select product_count from catalogmediabaseline)<>(
    select count(*) from catalog.product product join catalogmediarestore source on source.product_id=product.id
  ) then raise exception 'CATALOG_MEDIA_RESTORE_PRODUCT_COUNT_CHANGED'; end if;
  if exists(
    select 1 from catalog.product product join catalogmediarestore source on source.product_id=product.id
    where nullif(product.attributes->>'coverObject','') is null
      and nullif(product.attributes->>'coverUrl','') is null
  ) then raise exception 'CATALOG_MEDIA_RESTORE_INCOMPLETE'; end if;
  if exists(
    select 1 from catalog.product product join catalogmediarestore source on source.product_id=product.id
    where nullif(product.attributes->>'coverObject','') is null
      and product.attributes->>'coverUrl'!~'^https://'
  ) then raise exception 'CATALOG_MEDIA_RESTORE_URL_INVALID'; end if;
  if not exists(
    select 1 from runtime.schemahead
    where artifact='commerce' and migration_head='20260910010000'
      and migration_count=(select count(*) from runtime.schemaversion)
  ) then raise exception 'CATALOG_MEDIA_RESTORE_SCHEMA_HEAD_INVALID'; end if;
end
$assert$;

commit;
