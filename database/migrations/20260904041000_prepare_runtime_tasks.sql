begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904040000') then raise exception 'IDEAL_RUNTIME_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904041000') then raise exception 'IDEAL_RUNTIME_ALREADY_APPLIED'; end if;
  if (select count(*) from information_schema.tables where table_schema='runtime' and table_name in(
    'jobs','job_attempts','leases','imports','import_chunks','exports','deadletters'))<>7
  then raise exception 'IDEAL_RUNTIME_TABLES_MISSING'; end if;
end
$precondition$;

create index if not exists runtime_jobs_checkpoint on runtime.jobs(scope_id,owner,state,updated_at,id)
  include(fencing_token,progress,attempts,version);
create index if not exists runtime_import_checkpoint on runtime.imports(scope_id,owner,kind,state,updated_at,id)
  include(rows_total,rows_processed,rows_succeeded,rows_failed,version);
create index if not exists runtime_deadletter_retention on runtime.deadletters(retention_until,id)
  include(owner,source_kind,state) where state in('resolved','discarded');

select runtime.record_migration_evidence('20260904041000',
  (select count(*) from runtime.jobs)+(select count(*) from runtime.imports)+(select count(*) from runtime.exports),
  (select count(*) from runtime.jobs)+(select count(*) from runtime.imports)+(select count(*) from runtime.exports),0,0,
  'select owner,kind,state,count(*) from runtime.jobs group by owner,kind,state; select owner,kind,state,count(*) from runtime.imports group by owner,kind,state;',
  'select id,state,fencing_token,progress,checkpoint from runtime.jobs where state in(''queued'',''running'') order by updated_at,id;');
insert into runtime.schemaversion(version,checksum)
values('20260904041000',encode(public.digest('20260904041000_prepare_runtime_tasks','sha256'),'hex'));

do $assert$
begin
  if exists(select 1 from runtime.jobs where progress not between 0 and 100 or fencing_token<0) then raise exception 'IDEAL_JOB_PROGRESS_INVALID'; end if;
  if exists(select 1 from runtime.imports where rows_processed<>rows_succeeded+rows_failed) then raise exception 'IDEAL_IMPORT_PROGRESS_INVALID'; end if;
  if exists(select 1 from runtime.leases where deadline<=acquired_at or fencing_token<=0) then raise exception 'IDEAL_LEASE_INVALID'; end if;
end
$assert$;

commit;
