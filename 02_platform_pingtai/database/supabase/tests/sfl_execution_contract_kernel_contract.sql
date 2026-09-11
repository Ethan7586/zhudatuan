do $verify$
begin
  if (select count(*) from information_schema.columns where table_schema='runtime' and table_name='idempotency'
    and column_name=any(array['operation_id','business_number','execution_state','realm_id','node_id','membership_id','operation_hash','completed_at']))<>8 then
    raise exception 'SFL_EXECUTION_COLUMNS_MISSING';
  end if;
  if not exists(select 1 from runtime.event where type='runtime.operation.completed' and version=1 and owner='runtime') then
    raise exception 'SFL_EXECUTION_EVENT_MISSING';
  end if;
  if not has_column_privilege('zhudatuanpurchaseapi','runtime.idempotency','execution_state','UPDATE')
    or not has_column_privilege('zhudatuanpurchaseapi','runtime.idempotency','completed_at','UPDATE') then
    raise exception 'SFL_EXECUTION_PURCHASE_GRANT_MISSING';
  end if;
  if not has_table_privilege('zhudatuanwebapi','runtime.outbox','INSERT')
    or not exists(select 1 from pg_policies where schemaname='runtime' and tablename='outbox'
      and policyname='zhudatuanwebapiinsert' and cmd='INSERT') then
    raise exception 'SFL_EXECUTION_WEB_OUTBOX_POLICY_MISSING';
  end if;
end
$verify$;

do $constraints$
begin
  begin
    insert into runtime.idempotency(scope,actor_id,key,request_hash,state,expires_at,execution_state)
    values('scope:test','actor:test','invalid-state',repeat('a',64),'started',clock_timestamp()+interval '1 hour','invalid');
    raise exception 'SFL_EXECUTION_STATE_CONSTRAINT_MISSING';
  exception when check_violation then null;
  end;
  begin
    insert into runtime.idempotency(scope,actor_id,key,request_hash,state,expires_at,operation_hash)
    values('scope:test','actor:test','invalid-hash',repeat('a',64),'started',clock_timestamp()+interval '1 hour','invalid');
    raise exception 'SFL_EXECUTION_HASH_CONSTRAINT_MISSING';
  exception when check_violation then null;
  end;
end
$constraints$;

insert into runtime.idempotency(scope,actor_id,key,request_hash,state,expires_at,business_number,execution_state,operation_hash)
values('scope:test','actor:test','business-one',repeat('a',64),'started',clock_timestamp()+interval '1 hour','SFL-TEST-ONE','started',repeat('b',64));

do $business_number$
begin
  begin
    insert into runtime.idempotency(scope,actor_id,key,request_hash,state,expires_at,business_number,execution_state,operation_hash)
    values('scope:test','actor:test','business-two',repeat('a',64),'started',clock_timestamp()+interval '1 hour','SFL-TEST-ONE','started',repeat('b',64));
    raise exception 'SFL_EXECUTION_BUSINESS_NUMBER_NOT_UNIQUE';
  exception when unique_violation then null;
  end;
end
$business_number$;

do $rollback$
begin
  insert into runtime.idempotency(scope,actor_id,key,request_hash,state,expires_at,business_number,execution_state,operation_hash)
  values('scope:rollback','actor:rollback','rollback',repeat('c',64),'started',clock_timestamp()+interval '1 hour','SFL-ROLLBACK-ONE','started',repeat('d',64));
  insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
  values('event:rollback','runtime.operation.completed',1,'operation','SFL-ROLLBACK-ONE','scope:rollback','{}','trace:rollback',clock_timestamp(),clock_timestamp());
  raise exception 'INJECTED_ROLLBACK';
exception when raise_exception then
  if sqlerrm<>'INJECTED_ROLLBACK' then raise; end if;
end
$rollback$;

do $rollback_verify$
begin
  if exists(select 1 from runtime.idempotency where business_number='SFL-ROLLBACK-ONE')
    or exists(select 1 from runtime.outbox where id='event:rollback') then
    raise exception 'SFL_EXECUTION_ROLLBACK_LEAKED';
  end if;
end
$rollback_verify$;

set role zhudatuanwebapi;
insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
values('event:web-role','runtime.operation.completed',1,'operation','SFL-WEB-ONE','scope:web','{}','trace:web',clock_timestamp(),clock_timestamp());
reset role;
