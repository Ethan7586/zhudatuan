begin;

alter table runtime.idempotency
  add column if not exists operation_id text,
  add column if not exists business_number text,
  add column if not exists execution_state text,
  add column if not exists realm_id text,
  add column if not exists node_id text,
  add column if not exists membership_id text,
  add column if not exists operation_hash char(64),
  add column if not exists completed_at timestamptz;

alter table runtime.idempotency drop constraint if exists runtime_idempotency_execution_state_check;
alter table runtime.idempotency add constraint runtime_idempotency_execution_state_check
  check(execution_state is null or execution_state in('started','completed','compensation_required'));
alter table runtime.idempotency drop constraint if exists runtime_idempotency_operation_hash_check;
alter table runtime.idempotency add constraint runtime_idempotency_operation_hash_check
  check(operation_hash is null or operation_hash~'^[0-9a-f]{64}$');

create unique index if not exists runtime_idempotency_business_number
  on runtime.idempotency(business_number) where business_number is not null;
create index if not exists runtime_idempotency_operation_trace
  on runtime.idempotency(operation_id,realm_id,node_id,membership_id,created_at desc)
  where operation_id is not null;

do $grants$
begin
  if to_regrole('zhudatuanpurchaseapi') is not null then
    grant update(execution_state,completed_at) on runtime.idempotency to zhudatuanpurchaseapi;
  end if;
  if to_regrole('zhudatuanwebapi') is not null then
    grant insert on runtime.outbox to zhudatuanwebapi;
    drop policy if exists zhudatuanwebapiinsert on runtime.outbox;
    create policy zhudatuanwebapiinsert on runtime.outbox for insert to zhudatuanwebapi
      with check(access.web_scope_allowed(scope_id));
  end if;
end
$grants$;

insert into runtime.event(type,version,owner,schema_ref)
values('runtime.operation.completed',1,'runtime','contract://events/runtime.operation.completed/v1')
on conflict(type,version) do update set owner=excluded.owner,schema_ref=excluded.schema_ref;

commit;
