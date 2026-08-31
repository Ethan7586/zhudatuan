begin;
insert into runtime.idempotency(scope,actor_id,operation,key,request_hash,state,expires_at) values
  ('contract:scope','contract:actor','contract.first.write','contract:key',repeat('a',64),'started',clock_timestamp()+interval '1 hour'),
  ('contract:scope','contract:actor','contract.second.write','contract:key',repeat('b',64),'started',clock_timestamp()+interval '1 hour');
do $contract$ begin
  if (select count(*) from runtime.idempotency where scope='contract:scope' and actor_id='contract:actor' and key='contract:key')<>2 then
    raise exception 'IDEMPOTENCY_OPERATION_DIMENSION_MISSING';
  end if;
  begin
    insert into runtime.idempotency(scope,actor_id,operation,key,request_hash,state,expires_at)
    values('contract:scope','contract:actor','contract.first.write','contract:key',repeat('c',64),'started',clock_timestamp()+interval '1 hour');
    raise exception 'IDEMPOTENCY_DUPLICATE_ACCEPTED';
  exception when unique_violation then null; end;
end $contract$;
rollback;
