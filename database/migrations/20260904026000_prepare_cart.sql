begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904025000') then raise exception 'CART_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904026000') then raise exception 'CART_ALREADY_APPLIED'; end if;
  if exists(select 1 from cart.item group by cart_id,sku_id having count(*)>1 or sum(quantity)>999) then raise exception 'CART_SKU_DUPLICATE'; end if;
end $precondition$;

alter table cart.cart add column owner_kind text not null default 'member';
alter table cart.cart add column token_digest char(64);
alter table cart.cart alter column member_id drop not null;
alter table cart.cart drop constraint cart_state_check;
alter table cart.cart add constraint cart_state_check check(state in('active','converted','abandoned','merged')) not valid;
alter table cart.cart add constraint cart_owner_kind_check check(owner_kind in('member','anonymous')) not valid;
alter table cart.cart add constraint cart_owner_identity_check check(
  (owner_kind='member' and member_id is not null and token_digest is null)
  or (owner_kind='anonymous' and member_id is null and token_digest is not null)
) not valid;
alter table cart.cart add constraint cart_token_digest_check check(token_digest is null or token_digest~'^[0-9a-f]{64}$') not valid;
alter table cart.cart validate constraint cart_state_check;
alter table cart.cart validate constraint cart_owner_kind_check;
alter table cart.cart validate constraint cart_owner_identity_check;
alter table cart.cart validate constraint cart_token_digest_check;

alter table cart.item add column selected boolean not null default true;
drop index if exists cart.cart_one_active;
drop index if exists cart.cart_active_member_mall;
drop index if exists cart.cart_item_cart_listing_sku;
alter table cart.item drop column listing_version;
alter table cart.item drop column title_snapshot;
alter table cart.item drop column unit_minor;
alter table cart.item drop column currency;
alter table cart.item drop column price_version;

create unique index cart_active_member on cart.cart(member_id,mall_id,application_id)
  where state='active' and owner_kind='member';
create unique index cart_active_token on cart.cart(token_digest,mall_id,application_id)
  where state='active' and owner_kind='anonymous';
create unique index cart_item_sku on cart.item(cart_id,sku_id);
create index cart_item_listing on cart.item(cart_id,listing_id);

create table cart.mergeclaim(
  token_digest char(64) primary key check(token_digest~'^[0-9a-f]{64}$'),
  member_id text not null,
  mall_id text not null,
  application_id text not null,
  target_cart_id text not null references cart.cart(id),
  merged_at timestamptz not null
);
create index cart_mergeclaim_member on cart.mergeclaim(member_id,mall_id,application_id,merged_at desc);
alter table cart.mergeclaim enable row level security;
alter table cart.mergeclaim force row level security;
create policy appscope on cart.mergeclaim for all to shopapp using(access.scope_allowed(mall_id)) with check(access.scope_allowed(mall_id));
create policy jobscope on cart.mergeclaim for all to shopjob using(true) with check(true);
create policy readerscope on cart.mergeclaim for select to shopcartreader using(access.scope_allowed(mall_id));
create policy writerscope on cart.mergeclaim for all to shopcartwriter using(access.scope_allowed(mall_id)) with check(access.scope_allowed(mall_id));
grant select,insert on cart.mergeclaim to shopapp,shopjob,shopcartwriter;
grant select on cart.mergeclaim to shopcartreader;

create function cart.guard_cart() returns trigger language plpgsql security definer
set search_path=cart,pg_temp set row_security=off as $function$
begin
  if tg_op='INSERT' then
    if new.state<>'active' or new.version<>0 then raise exception 'CART_INITIAL_STATE_INVALID'; end if;
    return new;
  end if;
  if (new.id,new.owner_kind,new.member_id,new.token_digest,new.mall_id,new.application_id)
    is distinct from (old.id,old.owner_kind,old.member_id,old.token_digest,old.mall_id,old.application_id)
    then raise exception 'CART_OWNER_IMMUTABLE'; end if;
  if new.version<>old.version+1 or new.updated_at<old.updated_at then raise exception 'CART_VERSION_CONFLICT'; end if;
  if old.state<>'active' and new is distinct from old then raise exception 'CART_FINAL'; end if;
  if old.state='active' and new.state not in('active','converted','abandoned','merged') then raise exception 'CART_TRANSITION_INVALID'; end if;
  return new;
end
$function$;
create trigger cartguard before insert or update on cart.cart for each row execute function cart.guard_cart();

create function cart.guard_item() returns trigger language plpgsql security definer
set search_path=cart,pg_temp set row_security=off as $function$
begin
  if tg_op='INSERT' then
    if new.version<>0 then raise exception 'CART_ITEM_INITIAL_VERSION_INVALID'; end if;
    return new;
  end if;
  if (new.cart_id,new.listing_id,new.sku_id) is distinct from (old.cart_id,old.listing_id,old.sku_id)
    then raise exception 'CART_ITEM_IDENTITY_IMMUTABLE'; end if;
  if new.version<>old.version+1 then raise exception 'CART_ITEM_VERSION_CONFLICT'; end if;
  return new;
end
$function$;
create trigger cartitemguard before insert or update on cart.item for each row execute function cart.guard_item();
revoke all on function cart.guard_cart(),cart.guard_item() from public;

comment on table cart.mergeclaim is 'One-time anonymous-cart ownership transfer receipt; raw bearer tokens are never persisted.';
comment on column cart.cart.token_digest is 'SHA-256 digest of a 256-bit anonymous cart bearer; never the raw token.';
comment on table cart.item is 'Lightweight consumer selection only; catalog, pricing and inventory remain authoritative in their owning modules.';

insert into runtime.operation(id,owner,method,path,contract_version)
values('cart.anonymous.merge','cart','POST','/api/v1/carts/current/merge','5.0.0');
insert into capability.capability(id,kind,name,version,status)
values('cart.anonymous.merge','operation','cart.anonymous.merge',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience,targets)
values('cart.anonymous.merge','cart.anonymous.merge','cart.manage','storefront',array['storefront','miniapp']);
insert into capability.dependency(capability_id,depends_on_id) values('cart.anonymous.merge','cart.current.read');
insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
values('platform:cart.anonymous.merge','organization-platform-root','cart.anonymous.merge','enabled',null,'1970-01-01T00:00:00Z',null,1,clock_timestamp(),clock_timestamp(),'migration:cart','启用匿名购物车一次性合并');
insert into capability.entitlementhistory(id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
values('entitlementhistory:'||encode(public.digest('platform:cart.anonymous.merge:cart','sha256'),'hex'),'platform:cart.anonymous.merge','organization-platform-root','cart.anonymous.merge','enabled',null,
  '1970-01-01T00:00:00Z',null,1,'migration:cart','启用匿名购物车一次性合并',clock_timestamp());
update capability.capabilityset set version=version+1,updated_at=clock_timestamp() where scope_id='organization-platform-root';

update runtime.operation set contract_version='5.0.0' where owner='cart';
update capability.capability set version=version+1 where id in(select id from runtime.operation where owner='cart');
update runtime.contractcatalog set checksum='268a0f57009e52250d31fdec9b4688f1269016556f6f0150d625efd43b0189b0',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260904026000',(select count(*) from cart.cart),(select count(*) from cart.cart),0,0,
  'create index concurrently if not exists cart_active_token_live on cart.cart(token_digest,mall_id,application_id) where state=''active'' and owner_kind=''anonymous'';',
  'select owner_kind,state,count(*) from cart.cart group by owner_kind,state;'
);
insert into runtime.schemaversion(version,checksum)
values('20260904026000',encode(public.digest('20260904026000_prepare_cart','sha256'),'hex'));

do $assert$ begin
  if exists(select 1 from cart.cart where version<0 or (owner_kind='member')<>(member_id is not null) or (owner_kind='anonymous')<>(token_digest is not null))
    then raise exception 'CART_OWNER_INVARIANT_INVALID'; end if;
  if exists(select 1 from cart.item where quantity not between 1 and 999 or version<0)
    then raise exception 'CART_ITEM_INVARIANT_INVALID'; end if;
  if exists(select 1 from cart.item group by cart_id,sku_id having count(*)>1)
    then raise exception 'CART_SKU_INVARIANT_INVALID'; end if;
  if exists(select 1 from cart.item item left join cart.cart target on target.id=item.cart_id where target.id is null)
    then raise exception 'CART_ORPHAN_INVALID'; end if;
  if (select count(*) from runtime.operation)<>313 then raise exception 'CART_OPERATION_COUNT_INVALID'; end if;
  if (select count(*) from runtime.event)<>143 then raise exception 'CART_EVENT_COUNT_INVALID'; end if;
end $assert$;

commit;
