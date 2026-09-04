begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904029400') then raise exception 'RUNTIME_TASK_PUBLISH_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904029500') then raise exception 'RUNTIME_TASK_PUBLISH_ALREADY_APPLIED'; end if;
  if exists(select 1 from runtime.job where state='running') then raise exception 'RUNTIME_JOB_DRAIN_REQUIRED'; end if;
  if exists(select 1 from member.importjob where id!~'^import:') then raise exception 'MEMBER_IMPORT_ID_RECONCILIATION_REQUIRED'; end if;
  if exists(select 1 from member.importjob group by organization_id,sha256 having count(*)>1) then raise exception 'MEMBER_IMPORT_DUPLICATE_RECONCILIATION_REQUIRED'; end if;
end
$precondition$;

create temporary table runtime_job_map on commit drop as
select id legacy_id,case when id like 'job:%' then id else 'job:migrated:'||md5(id) end task_id from runtime.job;

insert into runtime.jobs(id,tenant_id,scope_id,kind,owner,queue,payload,state,priority,available_at,lease_owner,lease_deadline,
  fencing_token,checkpoint,progress,cancel_requested_at,attempts,idempotency_key,retention_until,version,created_by,updated_by,created_at,updated_at)
select map.task_id,coalesce(job.scope_id,'organization-platform-root'),coalesce(job.scope_id,'organization-platform-root'),job.kind,job.owner,
  'migration',job.payload,case job.state when 'completed' then 'succeeded' else job.state end,job.priority,job.available_at,null,null,
  job.fencing_token,jsonb_build_object('migratedAttempts',job.attempts),case when job.state='completed' then 100 else 0 end,null,
  job.attempts,map.task_id,clock_timestamp()+interval '90 days',1,'system:runtimemigration','system:runtimemigration',job.created_at,job.updated_at
from runtime.job job join runtime_job_map map on map.legacy_id=job.id
on conflict(id) do nothing;

insert into runtime.deadletters(id,tenant_id,scope_id,source_kind,source_id,owner,payload,error_code,attempts,state,retry_job_id,
  resolution,version,failed_at,reviewed_by,reviewed_at,retention_until)
select 'deadletter:migrated:'||md5(letter.id),coalesce(job.scope_id,'organization-platform-root'),
  coalesce(job.scope_id,'organization-platform-root'),case when letter.kind in('job','outbox','inbox','import','provider') then letter.kind else 'provider' end,
  coalesce(map.task_id,letter.source_id),letter.owner,letter.payload,letter.error_code,greatest(letter.attempts,1),
  case when letter.reviewed_at is null then 'open' else 'resolved' end,null,
  case when letter.reviewed_at is null then null else '迁移前已确认' end,1,letter.failed_at,
  case when letter.reviewed_at is null then null else 'system:runtimemigration' end,letter.reviewed_at,clock_timestamp()+interval '90 days'
from runtime.deadletter letter left join runtime_job_map map on letter.kind='job' and map.legacy_id=letter.source_id
left join runtime.job job on job.id=letter.source_id
on conflict(source_kind,source_id) do nothing;

insert into runtime.leases(resource,tenant_id,scope_id,owner,token,fencing_token,acquired_at,heartbeat_at,deadline,version)
select resource,'organization-platform-root','organization-platform-root',owner,token,greatest(version,1),acquired_at,acquired_at,
  deadline,greatest(version,1) from runtime.lease where deadline>acquired_at on conflict(resource) do nothing;

insert into runtime.imports(id,tenant_id,scope_id,owner,kind,object_key,file_hash,file_name,media_type,size_bytes,state,rows_total,
  rows_processed,rows_succeeded,rows_failed,checkpoint,error_report_key,idempotency_key,version,created_by,updated_by,created_at,updated_at,retention_until)
select source.id,source.organization_id,source.organization_id,'member','member',source.object_ref,source.sha256,'member-import.csv','text/csv',1,
  case source.state when 'validating' then 'preflight' when 'running' then 'ready' when 'reporting' then 'ready' when 'completed' then 'succeeded' else source.state end,
  source.total_count,source.cursor_value,source.success_count,source.failure_count,
  source.validation_summary||jsonb_build_object('migratedFrom',source.id,'lastError',source.last_error,'reportSha256',source.report_sha256,'reportSize',source.report_size),
  source.report_object_ref,'migration:'||source.id,1,'system:runtimemigration','system:runtimemigration',source.created_at,source.updated_at,
  greatest(source.updated_at,clock_timestamp())+interval '90 days' from member.importjob source;

insert into runtime.import_chunks(id,tenant_id,scope_id,import_id,sequence,row_start,row_end,payload_hash,payload,state,fencing_token,
  checkpoint,error_count,version,created_at,updated_at)
select 'importchunk:'||split_part(row.job_id,':',2)||':'||((row.row_number-2)/500)::integer,job.organization_id,job.organization_id,
  row.job_id,((row.row_number-2)/500)::integer,min(row.row_number),max(row.row_number),
  encode(public.digest(jsonb_agg(jsonb_build_object('row',row.row_number,'payload',row.payload) order by row.row_number)::text,'sha256'),'hex'),
  jsonb_agg(jsonb_build_object('row',row.row_number,'payload',row.payload) order by row.row_number),
  case when max(row.row_number)-1<=job.cursor_value then 'succeeded' else 'pending' end,null,
  jsonb_build_object('migrated',true),0,1,job.created_at,job.updated_at
from member.importrow row join member.importjob job on job.id=row.job_id
group by row.job_id,job.organization_id,job.cursor_value,job.created_at,job.updated_at,((row.row_number-2)/500)::integer;

insert into runtime.import_errors(import_id,scope_id,row_number,reason_code,field,detail)
select error.job_id,job.organization_id,error.row_number,error.reason_code,error.field,to_jsonb(error.detail)
from member.importerror error join member.importjob job on job.id=error.job_id on conflict do nothing;

update runtime.import_chunks chunk set error_count=(select count(*) from runtime.import_errors error
  where error.import_id=chunk.import_id and error.row_number between chunk.row_start and chunk.row_end)
where chunk.import_id in(select id from member.importjob);

drop function runtime.claim_job(text,text,integer,integer,text);
drop function runtime.acquire_lease(text,text,integer);
drop function runtime.release_lease(text,text,text);

create function runtime.claim_job(p_kind text,p_owner text,p_limit integer,p_lease_seconds integer,p_workload text)
returns setof runtime.jobs language plpgsql security definer set search_path=runtime,pg_temp as $function$
begin
  if p_limit not between 1 and 1000 or p_lease_seconds not between 5 and 900 or p_workload not in('jobs','provider') then
    raise exception 'JOB_CLAIM_ARGUMENT_INVALID';
  end if;
  return query with candidates as materialized(
    select id,state,attempts from runtime.jobs where kind=p_kind and cancel_requested_at is null and(
      state='queued' and available_at<=clock_timestamp() or state='running' and lease_deadline<=clock_timestamp())
    order by priority,available_at,id for update skip locked limit p_limit
  ), closed as(
    update runtime.job_attempts attempt set state='failed',error_code='JOB_LEASE_EXPIRED',finished_at=clock_timestamp()
    from candidates where candidates.state='running' and attempt.job_id=candidates.id and attempt.attempt=candidates.attempts
      and attempt.state='running' returning attempt.id
  ), claimed as(
    update runtime.jobs target set state='running',lease_owner=p_owner,
      lease_deadline=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempts=target.attempts+1,
      fencing_token=target.fencing_token+1,version=target.version+1,updated_by=p_owner,updated_at=clock_timestamp()
    from candidates where target.id=candidates.id returning target.*
  ), attempts as(
    insert into runtime.job_attempts(id,tenant_id,scope_id,job_id,attempt,fencing_token,worker_id,state,error_detail,started_at)
    select 'jobattempt:'||md5(claimed.id||':'||claimed.attempts::text||':'||claimed.fencing_token::text),claimed.tenant_id,
      claimed.scope_id,claimed.id,claimed.attempts,claimed.fencing_token,p_owner,'running','{}',clock_timestamp() from claimed
    returning id
  ) select claimed.* from claimed;
end
$function$;

revoke all on function runtime.claim_job(text,text,integer,integer,text) from public;
grant execute on function runtime.claim_job(text,text,integer,integer,text) to shopjob,shopprovider;

create or replace function runtime.guard_import_chunk()
returns trigger language plpgsql set search_path=pg_catalog,runtime,pg_temp as $function$
begin
  if tg_op='DELETE' then
    if not exists(select 1 from runtime.imports where id=old.import_id
      and state in('rejected','succeeded','failed','cancelled') and retention_until<=clock_timestamp()) then
      raise exception 'RUNTIME_IMPORT_CHUNK_IMMUTABLE';
    end if;
    return old;
  end if;
  if (new.id,new.tenant_id,new.scope_id,new.import_id,new.sequence,new.row_start,new.row_end,new.payload_hash,new.payload,new.created_at)
    is distinct from (old.id,old.tenant_id,old.scope_id,old.import_id,old.sequence,old.row_start,old.row_end,old.payload_hash,old.payload,old.created_at) then
    raise exception 'RUNTIME_IMPORT_CHUNK_IMMUTABLE';
  end if;
  if old.state in('pending','failed') and new.state='running' then
    if (new.checkpoint,new.error_count) is distinct from (old.checkpoint,old.error_count)
      or new.fencing_token<>coalesce(old.fencing_token,0)+1 or new.lease_expires_at<=clock_timestamp() then
      raise exception 'RUNTIME_IMPORT_LEASE_INVALID';
    end if;
  elsif old.state='running' and new.state='running' then
    if (new.checkpoint,new.error_count) is distinct from (old.checkpoint,old.error_count)
      or old.lease_expires_at>clock_timestamp() or new.fencing_token<>old.fencing_token+1 or new.lease_expires_at<=clock_timestamp() then
      raise exception 'RUNTIME_IMPORT_LEASE_INVALID';
    end if;
  elsif old.state='running' and new.state in('failed','succeeded') then
    if new.fencing_token<>old.fencing_token or new.lease_expires_at is not null then raise exception 'RUNTIME_IMPORT_LEASE_INVALID'; end if;
  elsif old.state in('failed','succeeded') and new.state='pending' then
    if new.fencing_token is not null or new.lease_expires_at is not null or new.checkpoint<>'{}'::jsonb or new.error_count<>0
      or not exists(select 1 from runtime.imports where id=old.import_id and state in('failed','rejected')) then
      raise exception 'RUNTIME_IMPORT_RETRY_INVALID';
    end if;
  else
    raise exception 'RUNTIME_IMPORT_CHUNK_STATE_INVALID';
  end if;
  if new.version<>old.version+1 or new.updated_at<old.updated_at then raise exception 'RUNTIME_IMPORT_CHUNK_VERSION_INVALID'; end if;
  return new;
end
$function$;

do $provider$
declare target text;
begin
  foreach target in array array['jobs','job_attempts','leases','imports','import_chunks','exports','deadletters'] loop
    execute format('grant select,insert,update,delete on runtime.%I to shopprovider',target);
    if not exists(select 1 from pg_policies where schemaname='runtime' and tablename=target and policyname='providerscope') then
      execute format('create policy providerscope on runtime.%I for all to shopprovider using(true) with check(true)',target);
    end if;
  end loop;
end
$provider$;

drop table runtime.job;
drop table runtime.deadletter;
drop table runtime.lease;
drop table member.importrow;
drop table member.importerror;
drop table member.importjob;

insert into access.permission(id,code,risk,status,name_zh) values
  ('permission:runtime.import.manage','runtime.import.manage','high','active','创建统一导入任务'),
  ('permission:runtime.task.manage','runtime.task.manage','high','active','取消和重试我的任务'),
  ('permission:runtime.task.read','runtime.task.read','high','active','查看我的后台任务');

insert into access.rolepermission(role_id,permission_id,effect)
select source.role_id,target.id,'allow' from access.rolepermission source
join access.permission existing on existing.id=source.permission_id and existing.code='runtime.health.read'
cross join access.permission target
where source.effect='allow' and target.code in('runtime.import.manage','runtime.task.manage','runtime.task.read')
on conflict(role_id,permission_id,effect) do nothing;

insert into runtime.operation(id,owner,method,path,contract_version) values
  ('runtime.jobs.read','runtime','GET','/api/v1/runtime/jobs','5.0.0'),
  ('runtime.jobs.cancel','runtime','POST','/api/v1/runtime/jobs/{jobid}/cancel','5.0.0'),
  ('runtime.imports.create','runtime','POST','/api/v1/runtime/imports','5.0.0'),
  ('runtime.imports.read','runtime','GET','/api/v1/runtime/imports/{importid}','5.0.0'),
  ('runtime.imports.retry','runtime','POST','/api/v1/runtime/imports/{importid}/retry','5.0.0'),
  ('runtime.exports.read','runtime','GET','/api/v1/runtime/exports/{exportid}','5.0.0'),
  ('runtime.exports.cancel','runtime','POST','/api/v1/runtime/exports/{exportid}/cancel','5.0.0');

insert into capability.capability(id,kind,name,version,status) values
  ('runtime.jobs.read','operation','查看我的后台任务',1,'active'),
  ('runtime.jobs.cancel','operation','取消后台任务',1,'active'),
  ('runtime.imports.create','operation','创建统一导入',1,'active'),
  ('runtime.imports.read','operation','查看导入任务',1,'active'),
  ('runtime.imports.retry','operation','重试导入任务',1,'active'),
  ('runtime.exports.read','operation','查看导出任务',1,'active'),
  ('runtime.exports.cancel','operation','取消导出任务',1,'active');

insert into capability.operation(operation_id,capability_id,permission_code,audience,targets) values
  ('runtime.jobs.read','runtime.jobs.read','runtime.task.read','console','{console}'),
  ('runtime.jobs.cancel','runtime.jobs.cancel','runtime.task.manage','console','{console}'),
  ('runtime.imports.create','runtime.imports.create','runtime.import.manage','console','{console}'),
  ('runtime.imports.read','runtime.imports.read','runtime.task.read','console','{console}'),
  ('runtime.imports.retry','runtime.imports.retry','runtime.task.manage','console','{console}'),
  ('runtime.exports.read','runtime.exports.read','runtime.task.read','console','{console}'),
  ('runtime.exports.cancel','runtime.exports.cancel','runtime.task.manage','console','{console}');

insert into capability.dependency(capability_id,depends_on_id) values
  ('runtime.imports.create','runtime.importing'),
  ('runtime.imports.read','runtime.importing'),
  ('runtime.imports.retry','runtime.importing');

insert into capability.entitlement(id,scope_id,capability_id,state,quota,effective_at,expires_at,version,created_at,updated_at,updated_by,reason)
select 'platform:'||id,'organization-platform-root',id,'enabled',null,'1970-01-01T00:00:00Z',null,1,
  clock_timestamp(),clock_timestamp(),'migration','runtimetaskpublish'
from capability.capability where id in('runtime.jobs.read','runtime.jobs.cancel','runtime.imports.create','runtime.imports.read',
  'runtime.imports.retry','runtime.exports.read','runtime.exports.cancel');

insert into capability.entitlementhistory(id,entitlement_id,scope_id,capability_id,state,quota,effective_at,expires_at,version,actor_id,reason,recorded_at)
select 'entitlementhistory:'||encode(public.digest(entitlement.id||':runtimetaskpublish','sha256'),'hex'),entitlement.id,entitlement.scope_id,
  entitlement.capability_id,entitlement.state,entitlement.quota,entitlement.effective_at,entitlement.expires_at,entitlement.version,
  'migration','runtimetaskpublish',clock_timestamp() from capability.entitlement entitlement
where entitlement.capability_id in('runtime.jobs.read','runtime.jobs.cancel','runtime.imports.create','runtime.imports.read',
  'runtime.imports.retry','runtime.exports.read','runtime.exports.cancel');

update capability.capabilityset set version=version+1,updated_at=clock_timestamp() where scope_id='organization-platform-root';
update runtime.contractcatalog set checksum='00e7a2744791112159a3e5dd6c1f94808565c3e87b9638f52a4873a2e54806a9',
  operation_count=(select count(*) from runtime.operation),
  event_count=(select count(*) from runtime.event where retired_at is null),published_at=clock_timestamp()
where artifact='commerce' and version='5.0.0' and status='active';

select runtime.record_migration_evidence('20260904029500',
  (select count(*) from runtime_job_map),(select count(*) from runtime.jobs where checkpoint ? 'migratedAttempts'),0,0,
  'create index concurrently if not exists runtime_jobs_kind_claim_live on runtime.jobs(kind,state,priority,available_at,id) where state in(''queued'',''running'');',
  'select queue,kind,state,count(*) from runtime.jobs group by queue,kind,state order by queue,kind,state;');
insert into runtime.schemaversion(version,checksum)
values('20260904029500',encode(public.digest('20260904029500_publish_runtime_tasks','sha256'),'hex'));

do $assert$
begin
  if to_regclass('runtime.job') is not null or to_regclass('runtime.deadletter') is not null or to_regclass('runtime.lease') is not null
    or to_regclass('member.importjob') is not null or to_regclass('member.importrow') is not null or to_regclass('member.importerror') is not null then
    raise exception 'LEGACY_RUNTIME_TASK_TABLE_REMAINS';
  end if;
  if to_regprocedure('runtime.claim_job(text,text,integer,integer,text)') is null then raise exception 'RUNTIME_JOB_CLAIM_MISSING'; end if;
  if (select count(*) from runtime.operation)<>363 or (select count(*) from capability.operation)<>363 then raise exception 'RUNTIME_TASK_OPERATION_COUNT_INVALID'; end if;
end
$assert$;

commit;
