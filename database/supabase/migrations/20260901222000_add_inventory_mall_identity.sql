begin;

alter table inventory.reservation add column mall_id text;
alter table inventory.movement add column mall_id text;

update inventory.reservation target set mall_id=stock.scope_id
from inventory.stockitem stock where stock.id=target.stockitem_id;
update inventory.movement target set mall_id=stock.scope_id
from inventory.stockitem stock where stock.id=target.stockitem_id;
update runtime.job job set scope_id=returned.mall_id,updated_at=clock_timestamp()
from fulfillment.returnrecord returned
where job.owner='inventory' and job.kind='inventorysync' and job.payload->>'return'=returned.id
  and job.scope_id is distinct from returned.mall_id;

do $backfill$
declare orphan_count bigint;
  conflict_count bigint;
  duplicate_count bigint;
  report jsonb;
begin
  select count(*) into orphan_count from(
    select 1 from inventory.reservation target left join inventory.stockitem stock on stock.id=target.stockitem_id
      where stock.id is null
    union all
    select 1 from inventory.movement target left join inventory.stockitem stock on stock.id=target.stockitem_id
      where stock.id is null
  ) orphans;

  select count(*) into conflict_count from(
    select 1 from inventory.reservation target join inventory.stockitem stock on stock.id=target.stockitem_id
      where target.mall_id<>stock.scope_id
    union all
    select 1 from inventory.movement target join inventory.stockitem stock on stock.id=target.stockitem_id
      where target.mall_id<>stock.scope_id
  ) conflicts;

  select coalesce(sum(repeated),0) into duplicate_count from(
    select count(*)-1 repeated from inventory.reservation group by id having count(*)>1
    union all
    select count(*)-1 from inventory.reservation group by mall_id,stockitem_id,owner_type,owner_id having count(*)>1
    union all
    select count(*)-1 from inventory.movement group by id having count(*)>1
    union all
    select count(*)-1 from inventory.movement group by mall_id,stockitem_id,kind,reference_type,reference_id having count(*)>1
  ) duplicates;

  report:=jsonb_build_object(
    'reservation',jsonb_build_object('total',(select count(*) from inventory.reservation),
      'nullMall',(select count(*) from inventory.reservation where mall_id is null)),
    'movement',jsonb_build_object('total',(select count(*) from inventory.movement),
      'nullMall',(select count(*) from inventory.movement where mall_id is null)),
    'orphans',orphan_count,'crossMallConflicts',conflict_count,'duplicateIdsOrBusinessKeys',duplicate_count);
  raise notice 'INVENTORY_MALL_BACKFILL_REPORT %',report;

  if exists(select 1 from inventory.reservation where mall_id is null)
    or exists(select 1 from inventory.movement where mall_id is null)
  then raise exception 'INVENTORY_MALL_BACKFILL_NULL'; end if;
  if orphan_count<>0 then raise exception 'INVENTORY_MALL_BACKFILL_ORPHAN:%',orphan_count; end if;
  if conflict_count<>0 then raise exception 'INVENTORY_MALL_BACKFILL_CONFLICT:%',conflict_count; end if;
  if duplicate_count<>0 then raise exception 'INVENTORY_MALL_BACKFILL_DUPLICATE:%',duplicate_count; end if;
end $backfill$;

alter table inventory.reservation alter column mall_id set not null;
alter table inventory.movement alter column mall_id set not null;

alter table inventory.stockitem add constraint inventory_stockitem_scope_id_key unique(scope_id,id);
alter table inventory.reservation add constraint inventory_reservation_mall_id_key unique(mall_id,id);
alter table inventory.movement add constraint inventory_movement_mall_id_key unique(mall_id,id);

alter table inventory.reservation add constraint inventory_reservation_mall_stock_fkey foreign key(mall_id,stockitem_id)
  references inventory.stockitem(scope_id,id);
alter table inventory.movement add constraint inventory_movement_mall_stock_fkey foreign key(mall_id,stockitem_id)
  references inventory.stockitem(scope_id,id);

alter table inventory.reservation drop constraint reservation_stockitem_id_owner_type_owner_id_key;
alter table inventory.reservation add constraint inventory_reservation_mall_owner_key
  unique(mall_id,stockitem_id,owner_type,owner_id);
alter table inventory.movement drop constraint movement_stockitem_id_kind_reference_type_reference_id_key;
alter table inventory.movement add constraint inventory_movement_mall_reference_key
  unique(mall_id,stockitem_id,kind,reference_type,reference_id);

create index inventory_reservation_mall_owner_state on inventory.reservation(mall_id,owner_type,owner_id,state,id);
create index inventory_movement_mall_reference on inventory.movement(mall_id,reference_type,reference_id,kind,id);

insert into runtime.schemaversion(version,checksum)
values('20260901222000',encode(public.digest('inventory-mall-identity:v1','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from information_schema.columns where table_schema='inventory'
      and table_name in('reservation','movement') and column_name='mall_id' and is_nullable='NO')<>2
  then raise exception 'INVENTORY_MALL_COLUMN_INCOMPLETE'; end if;
  if not exists(select 1 from pg_constraint where conname='inventory_reservation_mall_stock_fkey')
    or not exists(select 1 from pg_constraint where conname='inventory_movement_mall_stock_fkey')
  then raise exception 'INVENTORY_MALL_COMPOSITE_FK_INCOMPLETE'; end if;
  if not exists(select 1 from runtime.schemaversion where version='20260901222000')
  then raise exception 'TARGET_SCHEMA_VERSION_MISSING'; end if;
end $assert$;

commit;
