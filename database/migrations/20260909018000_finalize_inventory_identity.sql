begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260909017000') then
    raise exception 'INVENTORY_IDENTITY_PREVIOUS_HEAD_MISSING';
  end if;
  if exists(select 1 from runtime.schemaversion where version='20260909018000') then
    raise exception 'INVENTORY_IDENTITY_ALREADY_APPLIED';
  end if;
end
$precondition$;

create temporary table inventoryidentitycutover(
  previous_id text primary key,
  canonical_id text not null unique
) on commit drop;

create temporary table inventoryidentitybaseline on commit drop as
select count(*)::bigint rows_count,coalesce(sum(onhand),0)::bigint onhand_total
from inventory.stockitem;

insert into inventoryidentitycutover(previous_id,canonical_id)
select stock.id,'stock:cutover:'||encode(public.digest(stock.id,'sha256'),'hex')
from inventory.stockitem stock
where stock.id!~'^stock:[A-Za-z0-9][A-Za-z0-9.:/-]*$';

alter table inventory.adjustmentrequest drop constraint adjustmentrequest_stockitem_id_fkey;
alter table inventory.cutoverreview drop constraint cutoverreview_stockitem_id_fkey;
alter table inventory.movement drop constraint movement_stockitem_id_fkey;
alter table inventory.observation drop constraint observation_stockitem_id_fkey;
alter table inventory.reservation drop constraint reservation_stockitem_id_fkey;
alter table inventory.snapshot drop constraint snapshot_stockitem_id_fkey;

alter table inventory.movement disable trigger inventorymovementimmutable;
alter table inventory.reservation disable trigger inventoryreservationguard;
alter table inventory.stockitem disable trigger inventorystockguard;

update inventory.adjustmentrequest target set stockitem_id=mapping.canonical_id
from inventoryidentitycutover mapping where target.stockitem_id=mapping.previous_id;
update inventory.cutoverreview target set stockitem_id=mapping.canonical_id
from inventoryidentitycutover mapping where target.stockitem_id=mapping.previous_id;
update inventory.movement target set stockitem_id=mapping.canonical_id
from inventoryidentitycutover mapping where target.stockitem_id=mapping.previous_id;
update inventory.observation target set stockitem_id=mapping.canonical_id
from inventoryidentitycutover mapping where target.stockitem_id=mapping.previous_id;
update inventory.reservation target set stockitem_id=mapping.canonical_id
from inventoryidentitycutover mapping where target.stockitem_id=mapping.previous_id;
update inventory.snapshot target set stockitem_id=mapping.canonical_id
from inventoryidentitycutover mapping where target.stockitem_id=mapping.previous_id;
update inventory.stockitem target set id=mapping.canonical_id
from inventoryidentitycutover mapping where target.id=mapping.previous_id;

alter table inventory.stockitem enable trigger inventorystockguard;
alter table inventory.reservation enable trigger inventoryreservationguard;
alter table inventory.movement enable trigger inventorymovementimmutable;

alter table inventory.adjustmentrequest add constraint adjustmentrequest_stockitem_id_fkey
  foreign key(stockitem_id) references inventory.stockitem(id) not valid;
alter table inventory.cutoverreview add constraint cutoverreview_stockitem_id_fkey
  foreign key(stockitem_id) references inventory.stockitem(id) not valid;
alter table inventory.movement add constraint movement_stockitem_id_fkey
  foreign key(stockitem_id) references inventory.stockitem(id) not valid;
alter table inventory.observation add constraint observation_stockitem_id_fkey
  foreign key(stockitem_id) references inventory.stockitem(id) not valid;
alter table inventory.reservation add constraint reservation_stockitem_id_fkey
  foreign key(stockitem_id) references inventory.stockitem(id) not valid;
alter table inventory.snapshot add constraint snapshot_stockitem_id_fkey
  foreign key(stockitem_id) references inventory.stockitem(id) not valid;

alter table inventory.adjustmentrequest validate constraint adjustmentrequest_stockitem_id_fkey;
alter table inventory.cutoverreview validate constraint cutoverreview_stockitem_id_fkey;
alter table inventory.movement validate constraint movement_stockitem_id_fkey;
alter table inventory.observation validate constraint observation_stockitem_id_fkey;
alter table inventory.reservation validate constraint reservation_stockitem_id_fkey;
alter table inventory.snapshot validate constraint snapshot_stockitem_id_fkey;

select runtime.record_migration_evidence(
  '20260909018000',
  (select rows_count from inventoryidentitybaseline),
  (select count(*) from inventory.stockitem),
  (select onhand_total from inventoryidentitybaseline),
  (select coalesce(sum(onhand),0) from inventory.stockitem),
  'select id from inventory.stockitem where id!~''^stock:[A-Za-z0-9][A-Za-z0-9.:/-]*$'' order by id;',
  'select stockitem_id from inventory.reservation reservation where not exists(select 1 from inventory.stockitem stock where stock.id=reservation.stockitem_id) order by stockitem_id;'
);

insert into runtime.schemaversion(version,checksum)
values('20260909018000',encode(public.digest('20260909018000_finalize_inventory_identity','sha256'),'hex'));

update runtime.schemahead set
  migration_head='20260909018000',
  migration_count=(select count(*) from runtime.schemaversion),
  checksum=(select encode(public.digest(string_agg(version||chr(31)||checksum,chr(30) order by version),'sha256'),'hex') from runtime.schemaversion),
  published_by='migration:inventory',
  published_at=clock_timestamp()
where artifact='commerce';

do $assert$
begin
  if (select rows_count from inventoryidentitybaseline)<>(select count(*) from inventory.stockitem)
    or (select onhand_total from inventoryidentitybaseline)<>(select coalesce(sum(onhand),0) from inventory.stockitem) then
    raise exception 'INVENTORY_STOCK_BALANCE_CHANGED';
  end if;
  if exists(select 1 from inventory.stockitem where id!~'^stock:[A-Za-z0-9][A-Za-z0-9.:/-]*$') then
    raise exception 'INVENTORY_STOCK_IDENTITY_INVALID';
  end if;
  if exists(
    select 1 from pg_trigger
    where tgrelid in('inventory.stockitem'::regclass,'inventory.reservation'::regclass,'inventory.movement'::regclass)
      and tgname in('inventorystockguard','inventoryreservationguard','inventorymovementimmutable') and tgenabled<>'O'
  ) then raise exception 'INVENTORY_GUARD_NOT_ENABLED'; end if;
  if not exists(
    select 1 from runtime.schemahead
    where artifact='commerce' and migration_head='20260909018000'
      and migration_count=(select count(*) from runtime.schemaversion)
  ) then raise exception 'INVENTORY_IDENTITY_SCHEMA_HEAD_INVALID'; end if;
end
$assert$;

commit;
