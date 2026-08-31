begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829103000') then raise exception 'JOB_FENCING_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829104000')
    or exists(select 1 from information_schema.columns where table_schema='runtime' and table_name='job' and column_name='fencing_token') then
    raise exception 'JOB_FENCING_ALREADY_APPLIED';
  end if;
end $precondition$;

create temporary table job_reconcile on commit drop as select count(*)::bigint rows,0::numeric minor from runtime.job;
alter table runtime.job add column fencing_token bigint not null default 0;
alter table runtime.job add constraint runtime_job_fencing_token check(fencing_token>=0) not valid;
alter table runtime.job validate constraint runtime_job_fencing_token;
create index runtime_job_fenced_claim on runtime.job(kind,state,priority,available_at,id);

create or replace function runtime.claim_job(p_kind text,p_owner text,p_limit integer,p_lease_seconds integer)
returns setof runtime.job language plpgsql security definer set search_path=runtime,pg_temp as $function$
begin
  if p_limit not between 1 and 1000 or p_lease_seconds not between 5 and 900 then raise exception 'JOB_CLAIM_ARGUMENT_INVALID'; end if;
  return query with candidates as(
    select id from runtime.job where kind=p_kind and ((state='queued' and available_at<=clock_timestamp())
      or (state='running' and lease_deadline<=clock_timestamp())) order by priority,available_at,id for update skip locked limit p_limit
  ) update runtime.job target set state='running',lease_owner=p_owner,
    lease_deadline=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempts=target.attempts+1,
    fencing_token=target.fencing_token+1,updated_at=clock_timestamp()
    from candidates where target.id=candidates.id returning target.*;
end $function$;

select runtime.record_migration_evidence('20260829104000',(select rows from job_reconcile),(select count(*) from runtime.job),0,0,
  'create index concurrently if not exists runtime_job_claim_live on runtime.job(kind,state,priority,available_at,id);',
  'update runtime.job set state=''queued'',lease_owner=null,lease_deadline=null where state=''running'' and lease_deadline<=clock_timestamp();');
insert into runtime.schemaversion(version,checksum)
values('20260829104000',encode(public.digest('20260829104000_job_lease_fencing','sha256'),'hex'));

commit;
