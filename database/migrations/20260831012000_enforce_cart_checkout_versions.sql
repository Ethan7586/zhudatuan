begin;

insert into runtime.migrationexception(id,migration,aggregate_type,aggregate_id,reason,evidence,state,detected_at)
select 'migrationexception:'||md5('20260831012000:cart:'||member_id||':'||mall_id),'20260831012000','cart',member_id||':'||mall_id,
  'CART_ACTIVE_DUPLICATE',jsonb_build_object('member',member_id,'mall',mall_id,'carts',jsonb_agg(id order by id)),'open',clock_timestamp()
from cart.cart where state='active' group by member_id,mall_id having count(*)>1
on conflict(migration,aggregate_type,aggregate_id) do nothing;

insert into runtime.migrationexception(id,migration,aggregate_type,aggregate_id,reason,evidence,state,detected_at)
select 'migrationexception:'||md5('20260831012000:item:'||cart_id||':'||listing_id||':'||sku_id),'20260831012000','cart.item',cart_id||':'||listing_id||':'||sku_id,
  'CART_LINE_DUPLICATE',jsonb_build_object('cart',cart_id,'listing',listing_id,'sku',sku_id,'versions',jsonb_agg(version order by version)),'open',clock_timestamp()
from cart.item group by cart_id,listing_id,sku_id having count(*)>1
on conflict(migration,aggregate_type,aggregate_id) do nothing;

insert into runtime.migrationexception(id,migration,aggregate_type,aggregate_id,reason,evidence,state,detected_at)
select 'migrationexception:'||md5('20260831012000:checkout:'||cart_id),'20260831012000','checkout.session',cart_id,
  'CHECKOUT_CURRENT_QUOTE_DUPLICATE',jsonb_build_object('cart',cart_id,'sessions',jsonb_agg(id order by id)),'open',clock_timestamp()
from checkout.session where state='quoted' group by cart_id having count(*)>1
on conflict(migration,aggregate_type,aggregate_id) do nothing;

insert into runtime.migrationexception(id,migration,aggregate_type,aggregate_id,reason,evidence,state,detected_at)
select 'migrationexception:'||md5('20260831012000:invalid:'||kind||':'||id),'20260831012000',kind,id,
  'CART_VERSION_OR_QUANTITY_INVALID',evidence,'open',clock_timestamp()
from (
  select 'cart'::text kind,id,jsonb_build_object('version',version) evidence from cart.cart where version<0
  union all
  select 'cart.item',cart_id||':'||listing_id,jsonb_build_object('version',version,'quantity',quantity) from cart.item where version<0 or quantity not between 1 and 999
) invalid
on conflict(migration,aggregate_type,aggregate_id) do nothing;

commit;

do $$
begin
  if exists(select 1 from runtime.migrationexception where migration='20260831012000' and state='open') then
    raise exception 'CART_CHECKOUT_VERSION_MIGRATION_BLOCKED';
  end if;
end
$$;

begin;

alter table cart.item
  add column title_snapshot text,
  add column unit_minor bigint,
  add column currency char(3),
  add column price_version text;

update cart.item item set
  title_snapshot=coalesce(listing.title,'Unavailable item'),
  unit_minor=coalesce(currentprice.amount_minor,0),
  currency=coalesce(currentprice.currency,'CNY'),
  price_version=coalesce(currentprice.id,'unavailable')
from catalog.listing listing
left join lateral(
  select price.id,price.amount_minor,book.currency from pricing.pricebook book
  join pricing.price price on price.book_id=book.id
  where book.scope_id=listing.scope_id and book.status='active' and price.sku_id=listing.sku_id
    and price.effective_at<=clock_timestamp() and (price.expires_at is null or price.expires_at>clock_timestamp())
  order by price.effective_at desc,price.id limit 1
) currentprice on true
where listing.id=item.listing_id;

update cart.item set title_snapshot='Unavailable item',unit_minor=0,currency='CNY',price_version='unavailable'
where title_snapshot is null;

alter table cart.item
  alter column title_snapshot set not null,
  alter column unit_minor set not null,
  alter column currency set not null,
  alter column price_version set not null,
  add constraint cart_item_unit_minor_nonnegative check(unit_minor>=0),
  add constraint cart_item_currency_format check(currency~'^[A-Z]{3}$');

alter table cart.cart drop constraint if exists cart_version_check;
alter table cart.cart add constraint cart_version_check check(version>=0);
alter table cart.item drop constraint if exists item_version_check;
alter table cart.item add constraint item_version_check check(version>=0);
alter table cart.item drop constraint if exists item_quantity_check;
alter table cart.item add constraint item_quantity_check check(quantity between 1 and 999);

create unique index if not exists cart_active_member_mall
  on cart.cart(member_id,mall_id) where state='active';
create unique index if not exists cart_item_cart_listing_sku
  on cart.item(cart_id,listing_id,sku_id);
create unique index if not exists checkout_current_quote_per_cart
  on checkout.session(cart_id) where state='quoted';

alter table runtime.idempotency drop constraint if exists idempotency_state_check;
alter table runtime.idempotency add column if not exists checkpoint jsonb;
alter table runtime.idempotency add column if not exists resource_type text;
alter table runtime.idempotency add column if not exists resource_id text;
alter table runtime.idempotency add column if not exists response_hash char(64);
alter table runtime.idempotency add constraint idempotency_state_check
  check(state in('started','checkpointed','completed','failed'));
alter table runtime.idempotency add constraint runtime_idempotency_resource_pair
  check((resource_type is null)=(resource_id is null));
alter table runtime.idempotency add constraint runtime_idempotency_response_hash
  check(response_hash is null or response_hash~'^[0-9a-f]{64}$');

update runtime.idempotency set checkpoint=jsonb_build_object('phase',case when state='completed' then 'completed' else state end),
  response_hash=case when response is null then null else encode(public.digest(response::text,'sha256'),'hex') end
where checkpoint is null or (response is not null and response_hash is null);

do $roles$
begin
  if exists(select 1 from pg_roles where rolname='zhudatuanpurchaseapi') then
    execute 'grant update(state,response,checkpoint,resource_type,resource_id,response_hash) on runtime.idempotency to zhudatuanpurchaseapi';
    drop policy if exists zhudatuanpurchaseapiupdate on runtime.idempotency;
    execute $policy$create policy zhudatuanpurchaseapiupdate on runtime.idempotency for update to zhudatuanpurchaseapi
      using(actor_id=nullif(current_setting('app.actor_id',true),'') and access.purchase_audit_scope_allowed(scope))
      with check(actor_id=nullif(current_setting('app.actor_id',true),'') and access.purchase_audit_scope_allowed(scope)
        and state in('checkpointed','completed','failed'))$policy$;
  end if;
  if exists(select 1 from pg_roles where rolname='zhudatuanwebapi') then
    drop policy if exists zhudatuanwebapiupdate on runtime.idempotency;
    execute $policy$create policy zhudatuanwebapiupdate on runtime.idempotency for update to zhudatuanwebapi
      using(actor_id=nullif(current_setting('app.actor_id',true),'') and access.web_audit_scope_allowed(scope))
      with check(actor_id=nullif(current_setting('app.actor_id',true),'') and access.web_audit_scope_allowed(scope)
        and state in('checkpointed','completed','failed'))$policy$;
  end if;
end
$roles$;

commit;
