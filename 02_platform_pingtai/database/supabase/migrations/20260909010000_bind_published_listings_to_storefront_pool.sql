begin;

-- A mall listing is only visible through the pool bound to its active storefront.
-- Earlier catalog-package imports created a draft listing without that projection;
-- preserve the independent import step and bind the listing when publication occurs.
with targets as materialized (
  select listing.id,listing.sku_id,listing.version,binding.pool_id
  from catalog.listing listing
  join lateral (
    select storefront.pool_id
    from experience.binding storefront
    join experience.application application on application.id=storefront.application_id
      and application.status='active' and storefront.domain=application.public_slug
    where storefront.mall_id=listing.scope_id and exists(
      select 1 from experience.release release
      where release.application_id=application.id and release.state='active'
        and release.effective_at<=clock_timestamp()
        and (release.retired_at is null or release.retired_at>clock_timestamp())
    )
    order by application.updated_at desc,application.id,storefront.pool_id
    limit 1
  ) binding on true
  where listing.status='published' and listing.pool_id is null
), pooled as (
  insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at)
  select targets.pool_id,targets.sku_id,'included',
    'listing:'||targets.id||':v'||(targets.version+1)::text,clock_timestamp()
  from targets
  on conflict(pool_id,sku_id) do update
    set state='included',source_version=excluded.source_version
  returning pool_id,sku_id
)
update catalog.listing listing
set pool_id=targets.pool_id,version=listing.version+1,updated_at=clock_timestamp()
from targets
where listing.id=targets.id and exists(
  select 1 from pooled where pooled.pool_id=targets.pool_id and pooled.sku_id=targets.sku_id
);

insert into runtime.schemaversion(version,checksum)
values('20260909010000','cc49e9268f27438863c216dcd3773da785214db36d0c0866e49ba23da6b45cab');

do $assert$
begin
  if exists(
    select 1
    from catalog.listing listing
    join lateral (
      select storefront.pool_id
      from experience.binding storefront
      join experience.application application on application.id=storefront.application_id
        and application.status='active' and storefront.domain=application.public_slug
      where storefront.mall_id=listing.scope_id and exists(
        select 1 from experience.release release
        where release.application_id=application.id and release.state='active'
          and release.effective_at<=clock_timestamp()
          and (release.retired_at is null or release.retired_at>clock_timestamp())
      )
      order by application.updated_at desc,application.id,storefront.pool_id
      limit 1
    ) binding on true
    where listing.status='published' and listing.pool_id is null
  ) or not exists(
    select 1 from runtime.schemaversion
    where version='20260909010000'
      and checksum='cc49e9268f27438863c216dcd3773da785214db36d0c0866e49ba23da6b45cab'
  ) then
    raise exception 'PUBLISHED_STOREFRONT_POOL_BINDING_INCOMPLETE';
  end if;
end
$assert$;

commit;
