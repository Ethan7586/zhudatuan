begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829100000') then raise exception 'IDEMPOTENCY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829101000')
    or exists(select 1 from information_schema.columns where table_schema='runtime' and table_name='idempotency' and column_name='operation') then
    raise exception 'IDEMPOTENCY_ALREADY_APPLIED';
  end if;
  if exists(select 1 from runtime.idempotency where state='started') then raise exception 'IDEMPOTENCY_INFLIGHT_DRAIN_REQUIRED'; end if;
end $precondition$;

create temporary table idempotency_reconcile on commit drop as
select count(*)::bigint rows,0::numeric minor from runtime.idempotency;

alter table runtime.idempotency add column operation text;
update runtime.idempotency set operation='legacy.'||substr(encode(public.digest(scope,'sha256'),'hex'),1,32);
alter table runtime.idempotency alter column operation set not null;
alter table runtime.idempotency add constraint runtime_idempotency_operation
  check(operation~'^[a-z][a-z0-9]*(\.[a-z0-9]+)+$') not valid;
alter table runtime.idempotency validate constraint runtime_idempotency_operation;
alter table runtime.idempotency drop constraint idempotency_pkey;
alter table runtime.idempotency add primary key(scope,actor_id,operation,key);
create index runtime_idempotency_expiry on runtime.idempotency(expires_at,state);

select runtime.record_migration_evidence('20260829101000',(select rows from idempotency_reconcile),
  (select count(*) from runtime.idempotency),0,0,
  'create index concurrently if not exists runtime_idempotency_expiry_live on runtime.idempotency(expires_at,state);',
  'select count(*) from runtime.idempotency where state=''started'' or operation is null;');
insert into runtime.schemaversion(version,checksum)
values('20260829101000',encode(public.digest('20260829101000_operation_idempotency','sha256'),'hex'));

do $assert$ begin
  if exists(select scope,actor_id,operation,key from runtime.idempotency group by scope,actor_id,operation,key having count(*)>1) then
    raise exception 'IDEMPOTENCY_UNIQUENESS_INVALID';
  end if;
end $assert$;

commit;
