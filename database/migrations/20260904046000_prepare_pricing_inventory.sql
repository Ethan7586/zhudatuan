begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904045000') then raise exception 'IDEAL_PRICE_STOCK_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904046000') then raise exception 'IDEAL_PRICE_STOCK_ALREADY_APPLIED'; end if;
  if to_regclass('pricing.pricebook') is null or to_regclass('pricing.price') is null or to_regclass('pricing.quote') is null
    or to_regclass('inventory.movement') is null or to_regclass('inventory.reservation') is null
  then raise exception 'IDEAL_PRICE_STOCK_TABLES_MISSING'; end if;
end
$precondition$;

create index if not exists pricing_quote_expiry on pricing.quote(expires_at,id) include(mall_id,member_id,payable_minor,currency,version);
create index if not exists inventory_reservation_owner on inventory.reservation(owner_type,owner_id,state,id)
  include(stockitem_id,quantity,expires_at,version);

select runtime.record_migration_evidence('20260904046000',
  (select count(*) from inventory.movement),(select count(*) from inventory.movement),0,0,
  'select scope_id,currency,count(*) from pricing.pricebook group by scope_id,currency;',
  'select stockitem_id,sum(quantity) quantity from inventory.reservation where state=''reserved'' group by stockitem_id;');
insert into runtime.schemaversion(version,checksum)
values('20260904046000',encode(public.digest('20260904046000_prepare_pricing_inventory','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from pricing.pricebook where currency<>'CNY' or version<=0) then raise exception 'IDEAL_PRICEBOOK_INVALID'; end if;
  if exists(select 1 from pricing.quote where expires_at<=created_at or payable_minor<0 or version<=0) then raise exception 'IDEAL_QUOTE_INVALID'; end if;
  if exists(select 1 from inventory.reservation where quantity<=0 or expires_at<=created_at or version<=0)
    then raise exception 'IDEAL_RESERVATION_INVALID'; end if;
end
$assert$;

commit;
