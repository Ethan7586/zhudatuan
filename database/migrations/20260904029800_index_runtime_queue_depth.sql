begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904029700') then raise exception 'RUNTIME_QUEUE_INDEX_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904029800') then raise exception 'RUNTIME_QUEUE_INDEX_ALREADY_APPLIED'; end if;
end
$precondition$;

create index runtime_jobs_active_depth on runtime.jobs(state,id) where state in('queued','running');

select runtime.record_migration_evidence('20260904029800',0,0,0,0,
  'create index concurrently if not exists runtime_jobs_active_depth on runtime.jobs(state,id) where state in(''queued'',''running'');',
  'select state,count(*) from runtime.jobs group by state;');
insert into runtime.schemaversion(version,checksum)
values('20260904029800',encode(public.digest('20260904029800_index_runtime_queue_depth','sha256'),'hex'));

do $assert$
begin
  if to_regclass('runtime.runtime_jobs_active_depth') is null then raise exception 'RUNTIME_QUEUE_INDEX_MISSING'; end if;
end
$assert$;

commit;
