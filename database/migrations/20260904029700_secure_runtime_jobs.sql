begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904029600') then raise exception 'RUNTIME_JOB_SECURITY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904029700') then raise exception 'RUNTIME_JOB_SECURITY_ALREADY_APPLIED'; end if;
end
$precondition$;

with drained as(
  update runtime.jobs set state='cancelled',cancel_requested_at=coalesce(cancel_requested_at,clock_timestamp()),
    lease_owner=null,lease_deadline=null,version=version+1,updated_by='runtime:migration',updated_at=clock_timestamp()
  where state in('queued','running') returning id,attempts
)
update runtime.job_attempts attempt set state='cancelled',error_code='RUNTIME_JOB_SECURITY_CUTOVER',finished_at=clock_timestamp()
from drained where attempt.job_id=drained.id and attempt.attempt=drained.attempts and attempt.state='running';

create function runtime.current_task_authorization()
returns jsonb language plpgsql volatile set search_path=pg_catalog,runtime,pg_temp as $function$
declare
  raw text := nullif(current_setting('app.authorization_snapshot',true),'');
  evidence jsonb;
  workload text := nullif(current_setting('app.workload',true),'');
  actor text := nullif(current_setting('app.actor_id',true),'');
  scope text := nullif(current_setting('app.scope_id',true),'');
  operation text := nullif(current_setting('app.operation_id',true),'');
begin
  if raw is not null then
    begin evidence := raw::jsonb; exception when others then raise exception 'JOB_AUTHORIZATION_INVALID'; end;
    if jsonb_typeof(evidence)<>'object' or evidence->>'kind'<>'user' or not(evidence ?& array['actor','membership','organization','scope','target','operation','accessVersion','credentialVersion','capabilityVersion','capturedAt']) then
      raise exception 'JOB_AUTHORIZATION_INVALID';
    end if;
    if evidence->>'actor' is distinct from actor or evidence->>'scope' is distinct from scope or evidence->>'operation' is distinct from operation then
      raise exception 'JOB_AUTHORIZATION_CONTEXT_MISMATCH';
    end if;
    return evidence;
  end if;
  if workload='api' then raise exception 'JOB_AUTHORIZATION_REQUIRED'; end if;
  if workload not in('jobs','provider') or actor is null or scope is null or operation is null then
    raise exception 'JOB_SYSTEM_AUTHORIZATION_REQUIRED';
  end if;
  return jsonb_build_object('kind','system','actor',actor,'scope',scope,'operation',operation,
    'source',workload,'capturedAt',clock_timestamp());
end
$function$;
revoke all on function runtime.current_task_authorization() from public;
grant execute on function runtime.current_task_authorization() to shopapp,shopjob,shopprovider;

alter table runtime.jobs add column authorization_snapshot jsonb;
update runtime.jobs set authorization_snapshot=jsonb_build_object(
  'kind','system','actor',created_by,'scope',scope_id,'operation','runtime.migration','source','migration','capturedAt',created_at);
alter table runtime.jobs alter column authorization_snapshot set default runtime.current_task_authorization();
alter table runtime.jobs alter column authorization_snapshot set not null;
alter table runtime.jobs add constraint runtime_job_authorization check(
  jsonb_typeof(authorization_snapshot)='object' and authorization_snapshot ?& array['kind','actor','scope','operation','capturedAt']
  and (authorization_snapshot->>'kind'='user' and authorization_snapshot ?&
    array['membership','organization','target','accessVersion','credentialVersion','capabilityVersion']
    or authorization_snapshot->>'kind'='system' and authorization_snapshot->>'source' in('jobs','provider','scheduler','migration')));

create function runtime.guard_job_identity()
returns trigger language plpgsql set search_path=pg_catalog,runtime,pg_temp as $function$
begin
  if (new.id,new.tenant_id,new.scope_id,new.kind,new.owner,new.queue,new.payload,new.authorization_snapshot,new.idempotency_key,
      new.created_by,new.created_at,new.retention_until)
    is distinct from
     (old.id,old.tenant_id,old.scope_id,old.kind,old.owner,old.queue,old.payload,old.authorization_snapshot,old.idempotency_key,
      old.created_by,old.created_at,old.retention_until) then
    raise exception 'RUNTIME_JOB_IDENTITY_IMMUTABLE';
  end if;
  return new;
end
$function$;
create trigger runtime_job_identity_guard before update on runtime.jobs
for each row execute function runtime.guard_job_identity();
revoke all on function runtime.guard_job_identity() from public;

select runtime.record_migration_evidence('20260904029700',
  (select count(*) from runtime.jobs),(select count(*) from runtime.jobs where authorization_snapshot ? 'kind'),0,0,
  'select state,count(*) from runtime.jobs group by state;',
  'select authorization_snapshot->>''kind'',count(*) from runtime.jobs group by authorization_snapshot->>''kind'';');
insert into runtime.schemaversion(version,checksum)
values('20260904029700',encode(public.digest('20260904029700_secure_runtime_jobs','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from runtime.jobs where authorization_snapshot is null) then raise exception 'RUNTIME_JOB_AUTHORIZATION_MISSING'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='runtime.jobs'::regclass and tgname='runtime_job_identity_guard' and not tgisinternal) then
    raise exception 'RUNTIME_JOB_IDENTITY_GUARD_MISSING';
  end if;
  if to_regprocedure('runtime.current_task_authorization()') is null then raise exception 'RUNTIME_JOB_AUTHORIZATION_FUNCTION_MISSING'; end if;
end
$assert$;

commit;
