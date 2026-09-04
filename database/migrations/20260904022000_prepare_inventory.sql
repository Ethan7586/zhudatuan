begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260904021000') then raise exception 'INVENTORY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904022000') then raise exception 'INVENTORY_ALREADY_APPLIED'; end if;
end $precondition$;

insert into runtime.imports(id,tenant_id,scope_id,owner,kind,object_key,file_hash,file_name,media_type,size_bytes,state,
  rows_total,rows_processed,rows_succeeded,rows_failed,checkpoint,error_report_key,idempotency_key,version,created_by,updated_by,
  created_at,updated_at,retention_until)
select source.id,source.scope_id,source.scope_id,'inventory','stock',source.object_ref,source.sha256,'inventory.csv','text/csv',1,
  case source.state when 'validating' then 'preflight' when 'reporting' then 'running' when 'completed' then 'succeeded' else source.state end,
  source.total_count,source.cursor_value,source.success_count,source.failure_count,
  source.validation_summary||jsonb_build_object('migratedFrom',source.id,'sizeBackfill','unknown')||
    case when source.last_error is null then '{}'::jsonb else jsonb_build_object('lastError',source.last_error) end||
    case when source.report_sha256 is null then '{}'::jsonb else jsonb_build_object('reportSha256',source.report_sha256,'reportSize',source.report_size) end,
  source.report_object_ref,source.id,greatest(source.cursor_value,1),'migration:inventory','migration:inventory',source.created_at,
  source.updated_at,greatest(source.updated_at,clock_timestamp())+interval '90 days'
from inventory.importjob source;

insert into runtime.import_chunks(id,tenant_id,scope_id,import_id,sequence,row_start,row_end,payload_hash,payload,state,
  fencing_token,checkpoint,error_count,version,created_at,updated_at)
select 'importchunk:'||split_part(row.job_id,':',2)||':'||((row.row_number-2)/500)::integer,job.scope_id,job.scope_id,row.job_id,
  ((row.row_number-2)/500)::integer,min(row.row_number),max(row.row_number),
  encode(public.digest(jsonb_agg(jsonb_build_object('row',row.row_number,'payload',row.payload) order by row.row_number)::text,'sha256'),'hex'),
  jsonb_agg(jsonb_build_object('row',row.row_number,'payload',row.payload) order by row.row_number),
  case when max(row.row_number)-1<=job.cursor_value then 'succeeded' else 'pending' end,null,'{}'::jsonb,0,1,job.created_at,job.updated_at
from inventory.importrow row join inventory.importjob job on job.id=row.job_id
group by row.job_id,job.scope_id,job.cursor_value,job.created_at,job.updated_at,((row.row_number-2)/500)::integer;

insert into runtime.import_errors(import_id,scope_id,row_number,reason_code,field,detail)
select job_id,scope_id,row_number,reason_code,field,to_jsonb(detail) from inventory.importerror;

do $scope$
declare source text;
begin
  select pg_get_functiondef('access.resource_scope(text,text,text)'::regprocedure) into source;
  source=replace(source,'select scope_id into resolved from inventory.importjob where id=p_resource','select scope_id into resolved from runtime.imports where id=p_resource');
  if source like '%inventory.importjob%' then raise exception 'INVENTORY_IMPORT_SCOPE_CUTOVER_FAILED'; end if;
  execute source;
end
$scope$;

drop table inventory.importrow;
drop table inventory.importerror;
drop table inventory.importjob;

update inventory.stockitem set version=1 where version=0;
update inventory.reservation set version=1 where version=0;
alter table inventory.stockitem add constraint inventory_stock_version_positive check(version>0) not valid;
alter table inventory.reservation add constraint inventory_reservation_version_positive check(version>0) not valid;
alter table inventory.reservation add constraint inventory_reservation_owner_kind check(owner_type in('order','checkout')) not valid;
alter table inventory.reservation add constraint inventory_reservation_period check(expires_at>created_at) not valid;
alter table inventory.stockitem validate constraint inventory_stock_version_positive;
alter table inventory.reservation validate constraint inventory_reservation_version_positive;
alter table inventory.reservation validate constraint inventory_reservation_owner_kind;
alter table inventory.reservation validate constraint inventory_reservation_period;
alter table inventory.snapshot add constraint inventory_snapshot_source_version unique(stockitem_id,source,source_version);

create index inventory_reservation_due on inventory.reservation(expires_at,stockitem_id,id) include(owner_type,owner_id,quantity,version)
where state='reserved';
create index inventory_stock_availability on inventory.stockitem(scope_id,sku_id,status,location_id,id)
include(onhand,safety,version,updated_at);

create function inventory.guard_stock() returns trigger language plpgsql security definer
set search_path=inventory,pg_temp set row_security=off as $function$
begin
  if new.version<1 then raise exception 'INVENTORY_STOCK_VERSION_INVALID'; end if;
  if tg_op='UPDATE' then
    if new.version<>old.version+1 then raise exception 'INVENTORY_STOCK_VERSION_CONFLICT'; end if;
    if (new.id,new.scope_id,new.sku_id,new.location_id) is distinct from (old.id,old.scope_id,old.sku_id,old.location_id)
      then raise exception 'INVENTORY_STOCK_IDENTITY_IMMUTABLE'; end if;
  end if;
  return new;
end
$function$;
create trigger inventorystockguard before insert or update on inventory.stockitem for each row execute function inventory.guard_stock();

create function inventory.guard_reservation() returns trigger language plpgsql security definer
set search_path=inventory,pg_temp set row_security=off as $function$
declare stock inventory.stockitem%rowtype;
declare reserved bigint;
begin
  if new.version<1 or new.expires_at<=new.created_at then raise exception 'INVENTORY_RESERVATION_INVALID'; end if;
  if tg_op='UPDATE' then
    if (new.id,new.stockitem_id,new.owner_type,new.owner_id,new.quantity,new.expires_at,new.created_at)
      is distinct from (old.id,old.stockitem_id,old.owner_type,old.owner_id,old.quantity,old.expires_at,old.created_at)
      then raise exception 'INVENTORY_RESERVATION_IDENTITY_IMMUTABLE'; end if;
    if old.state<>'reserved' and new.state<>old.state then raise exception 'INVENTORY_RESERVATION_FINAL'; end if;
    if old.state='reserved' and new.state not in('reserved','committed','released','expired') then raise exception 'INVENTORY_RESERVATION_TRANSITION_INVALID'; end if;
    if new.state<>old.state and new.version<>old.version+1 then raise exception 'INVENTORY_RESERVATION_VERSION_CONFLICT'; end if;
    if new.state=old.state and new.version<>old.version then raise exception 'INVENTORY_RESERVATION_VERSION_CONFLICT'; end if;
    return new;
  end if;
  if new.state<>'reserved' then raise exception 'INVENTORY_RESERVATION_INITIAL_STATE_INVALID'; end if;
  select * into stock from inventory.stockitem where id=new.stockitem_id for update;
  if stock.id is null or stock.status<>'active' then raise exception 'INVENTORY_STOCK_REQUIRED'; end if;
  select coalesce(sum(value.quantity),0) into reserved from inventory.reservation value
  where value.stockitem_id=new.stockitem_id and value.state='reserved' and value.expires_at>clock_timestamp();
  if stock.onhand-stock.safety-reserved<new.quantity then raise exception 'INVENTORY_INSUFFICIENT'; end if;
  return new;
end
$function$;
create trigger inventoryreservationguard before insert or update on inventory.reservation for each row execute function inventory.guard_reservation();

create function inventory.protect_movement() returns trigger language plpgsql as $function$
begin
  raise exception 'INVENTORY_LEDGER_IMMUTABLE';
end
$function$;
create trigger inventorymovementimmutable before update or delete on inventory.movement for each row execute function inventory.protect_movement();
revoke all on function inventory.guard_stock(),inventory.guard_reservation(),inventory.protect_movement() from public;

delete from runtime.event where type='inventory.stock.reserved';
insert into runtime.event(type,version,owner,schema_ref) values
  ('inventory.reservation.created',1,'inventory','contract://events/inventory.reservation.created/v1'),
  ('inventory.reservation.confirmed',1,'inventory','contract://events/inventory.reservation.confirmed/v1'),
  ('inventory.reservation.released',1,'inventory','contract://events/inventory.reservation.released/v1'),
  ('inventory.reservation.expired',1,'inventory','contract://events/inventory.reservation.expired/v1');
update capability.capability set version=2 where id in('inventory.availability.read','inventory.imports.create','inventory.imports.read');

update runtime.contractcatalog set checksum='59e06723a29d4ce8bb2c06821655224fc94d4ae4b92a728294d5458a9acb71c9',
  operation_count=(select count(*) from runtime.operation),event_count=(select count(*) from runtime.event),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence(
  '20260904022000',(select count(*) from runtime.imports where owner='inventory'),(select count(*) from runtime.imports where owner='inventory'),0,0,
  'create index concurrently if not exists inventory_reservation_due_live on inventory.reservation(expires_at,stockitem_id,id) where state=''reserved'';',
  'select state,count(*) from inventory.reservation group by state;'
);
insert into runtime.schemaversion(version,checksum) values('20260904022000','59e06723a29d4ce8bb2c06821655224fc94d4ae4b92a728294d5458a9acb71c9');

do $assert$ begin
  if exists(select 1 from information_schema.tables where table_schema='inventory' and table_name in('importjob','importrow','importerror'))
    then raise exception 'INVENTORY_PRIVATE_IMPORT_TABLE_REMAINS'; end if;
  if exists(select 1 from runtime.imports where owner='inventory' and rows_processed<>rows_succeeded+rows_failed)
    then raise exception 'INVENTORY_IMPORT_PROGRESS_INVALID'; end if;
  if exists(select 1 from inventory.stockitem where version<1 or onhand<0 or safety<0) then raise exception 'INVENTORY_STOCK_INVARIANT_INVALID'; end if;
  if exists(select 1 from inventory.reservation where version<1 or expires_at<=created_at or owner_type not in('order','checkout'))
    then raise exception 'INVENTORY_RESERVATION_INVARIANT_INVALID'; end if;
  if (select count(*) from runtime.event)<>133 then raise exception 'INVENTORY_EVENT_COUNT_INVALID'; end if;
end $assert$;

commit;
