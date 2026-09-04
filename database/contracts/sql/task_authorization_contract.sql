begin;

select set_config('app.tenant_id','tenant:contract',true),set_config('app.membership_id','membership:contract',true),
  set_config('app.scope_id','contract:scope',true),set_config('app.actor_id','principal:contract',true),
  set_config('app.operation_id','runtime.jobs.read',true),set_config('app.workload','api',true),
  set_config('app.authorization_snapshot','',true);

do $missing$
begin
  begin
    insert into runtime.jobs(id,tenant_id,scope_id,kind,owner,queue,payload,state,priority,available_at,idempotency_key,
      retention_until,version,created_by,updated_by,created_at,updated_at)
    values('job:authorization:missing','tenant:contract','contract:scope','contractjob','contract','contract','{}','queued',1,
      clock_timestamp(),'authorization:missing',clock_timestamp()+interval '1 day',1,'principal:contract','principal:contract',clock_timestamp(),clock_timestamp());
    raise exception 'JOB_MISSING_AUTHORIZATION_ACCEPTED';
  exception when raise_exception then
    if sqlerrm<>'JOB_AUTHORIZATION_REQUIRED' then raise; end if;
  end;
end
$missing$;

select set_config('app.authorization_snapshot','{"kind":"user","actor":"principal:contract","membership":"membership:contract","organization":"tenant:contract","scope":"contract:scope","target":"console","operation":"runtime.jobs.read","accessVersion":1,"credentialVersion":1,"capabilityVersion":1,"capturedAt":"2026-09-05T00:00:00.000Z"}',true);
insert into runtime.jobs(id,tenant_id,scope_id,kind,owner,queue,payload,state,priority,available_at,idempotency_key,
  retention_until,version,created_by,updated_by,created_at,updated_at)
values('job:authorization:user','tenant:contract','contract:scope','contractjob','contract','contract','{}','queued',1,
  clock_timestamp(),'authorization:user',clock_timestamp()+interval '1 day',1,'principal:contract','principal:contract',clock_timestamp(),clock_timestamp());

do $assert$
begin
  if not exists(select 1 from runtime.jobs where id='job:authorization:user'
    and authorization_snapshot->>'kind'='user' and authorization_snapshot->>'membership'='membership:contract') then
    raise exception 'JOB_USER_AUTHORIZATION_NOT_CAPTURED';
  end if;
end
$assert$;

rollback;
