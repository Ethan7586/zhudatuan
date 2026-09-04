begin;

-- Public storefront projection. Browsing a published mall catalog does not
-- require a membership; cart, checkout and payment remain on authenticated
-- canonical operations.
create or replace function catalog.public_storefront_catalog(
  p_application_slug text,
  p_limit integer default 24,
  p_offset integer default 0,
  p_category text default null
)
returns table(
  id text,
  sku_id text,
  name text,
  subtitle text,
  product_type text,
  cover_url text,
  amount_minor bigint,
  compare_minor bigint,
  available_stock bigint,
  supplier_name text,
  is_test boolean
)
language sql
stable
security definer
set search_path=pg_catalog,catalog,experience,pricing,inventory,organization,partner
set row_security=off
as $function$
  with selected_application as (
    select application.id application_id,binding.mall_id,binding.pool_id
    from experience.application application
    join experience.binding binding on binding.application_id=application.id and binding.domain=application.public_slug
    where application.public_slug=p_application_slug
      and application.status='active'
      and exists(
        select 1 from experience.release release
        where release.application_id=application.id and release.state='active'
          and release.effective_at<=clock_timestamp()
          and (release.retired_at is null or release.retired_at>clock_timestamp())
      )
    order by application.updated_at desc,application.id
    limit 1
  )
  select listing.id,sku.id,listing.title,product.attributes->>'subtitle',product.product_type,
    product.attributes->>'coverUrl',offer.amount_minor,offer.compare_minor,
    coalesce(stock.available,0),coalesce(supplier.name,'平台自营'),
    coalesce(product.attributes->>'testProduct'='true',false)
  from selected_application application
  join catalog.listing listing on listing.scope_id=application.mall_id and listing.pool_id=application.pool_id
  join catalog.sku sku on sku.id=listing.sku_id and sku.status='active'
  join catalog.product product on product.id=sku.product_id and product.status='active'
  left join partner.partner supplier on supplier.id=product.owner_partner_id and supplier.status='active'
  left join lateral (
    select price.amount_minor,price.compare_minor
    from pricing.pricebook book
    join pricing.price price on price.book_id=book.id and price.sku_id=sku.id
      and price.effective_at<=clock_timestamp()
      and (price.expires_at is null or price.expires_at>clock_timestamp())
    where book.scope_id=application.mall_id and book.status='active' and book.currency='CNY'
    order by price.effective_at desc,price.id
    limit 1
  ) offer on true
  left join lateral (
    select coalesce(sum(greatest(item.onhand-item.safety-coalesce(reserved.quantity,0),0)),0)::bigint available
    from inventory.stockitem item
    left join lateral (
      select coalesce(sum(reservation.quantity),0)::bigint quantity
      from inventory.reservation reservation
      where reservation.stockitem_id=item.id and reservation.state='active'
        and reservation.expires_at>clock_timestamp()
    ) reserved on true
    where item.sku_id=sku.id and item.status='active'
      and exists(
        select 1 from organization.unitclosure closure
        where closure.ancestor_id=application.mall_id and closure.descendant_id=item.scope_id
      )
  ) stock on true
  where listing.status='published'
    and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
    and (listing.expires_at is null or listing.expires_at>clock_timestamp())
    and (coalesce(p_category,'')='' or case product.product_type
      when 'virtual' then 'virtual-card' when 'voucher' then 'virtual-card'
      when 'service' then 'life' else 'welfare' end=p_category)
  order by listing.updated_at desc,listing.id
  limit least(greatest(coalesce(p_limit,24),1),100)
  offset greatest(coalesce(p_offset,0),0)
$function$;

revoke all on function catalog.public_storefront_catalog(text,integer,integer,text)
  from public,anon,authenticated,service_role,shopapp,shopjob,shopread,
    zhudatuanidentityapi,zhudatuanidentityjob,zhudatuanbootstrap;
grant execute on function catalog.public_storefront_catalog(text,integer,integer,text)
  to zhudatuanwebapi;

-- This ¥0.01 item is a real payment-flow product. The former test flag made
-- the H5 client reject it before cart creation.
update catalog.product
set attributes=attributes-'testProduct',version=version+1,updated_at=clock_timestamp()
where id='product:zdt-l1-first-order' and attributes->>'testProduct'='true';

insert into runtime.schemaversion(version,checksum)
values('20260903111000','d77bb51609c403a356b5cfd70462441a7b27410f9bab1265c94bb3cdd6567b78');

do $assert$
begin
  if to_regprocedure('catalog.public_storefront_catalog(text,integer,integer,text)') is null
    or has_function_privilege('public','catalog.public_storefront_catalog(text,integer,integer,text)','EXECUTE')
    or not has_function_privilege('zhudatuanwebapi','catalog.public_storefront_catalog(text,integer,integer,text)','EXECUTE')
    or not exists(select 1 from runtime.schemaversion
      where version='20260903111000'
        and checksum='d77bb51609c403a356b5cfd70462441a7b27410f9bab1265c94bb3cdd6567b78') then
    raise exception 'PUBLIC_STOREFRONT_CATALOG_INVALID';
  end if;
end
$assert$;

commit;
