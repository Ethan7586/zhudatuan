begin;

do $precondition$
begin
  if to_regclass('member.favorite') is null then raise exception 'PROVIDER_WORKLOAD_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260831016000') then raise exception 'PROVIDER_WORKLOAD_ALREADY_APPLIED'; end if;
end
$precondition$;

do $role$
begin
  if not exists(select 1 from pg_roles where rolname='shopprovider') then create role shopprovider nologin noinherit; end if;
end
$role$;

update runtime.job set kind='fulfillment',owner='fulfillment',state='queued',lease_owner=null,lease_deadline=null,updated_at=clock_timestamp()
where kind='returnauthorize' and state in('queued','running');

alter table runtime.job add column workload text generated always as(
  case when kind in('catalogsync','pricesync','inventorysync','statementsync','channelwebhook','fulfillment','tracking','extensionhealth')
    then 'provider' else 'jobs' end
) stored;
alter table runtime.job add constraint runtime_job_workload_valid check(workload in('jobs','provider'));
create index runtime_job_workload_claim on runtime.job(workload,kind,state,priority,available_at,id);

-- JobCatalog.ts is the only job-definition authority. Keeping a partial SQL
-- mirror made ordinary workers impossible to claim and duplicated runtime
-- configuration, so the mirror is hard-cut here.
drop table runtime.jobdefinition;

drop function runtime.claim_job(text,text,integer,integer);
create function runtime.claim_job(p_kind text,p_owner text,p_limit integer,p_lease_seconds integer,p_workload text)
returns setof runtime.job language plpgsql security definer set search_path=runtime,pg_temp as $function$
begin
  if p_limit not between 1 and 1000 or p_lease_seconds not between 5 and 900 or p_workload not in('jobs','provider') then
    raise exception 'JOB_CLAIM_ARGUMENT_INVALID';
  end if;
  return query with candidates as(
    select id from runtime.job where kind=p_kind and workload=p_workload and(
      (state='queued' and available_at<=clock_timestamp()) or(state='running' and lease_deadline<=clock_timestamp()))
    order by priority,available_at,id for update skip locked limit p_limit
  ) update runtime.job target set state='running',lease_owner=p_owner,
    lease_deadline=clock_timestamp()+make_interval(secs=>p_lease_seconds),attempts=target.attempts+1,
    fencing_token=target.fencing_token+1,updated_at=clock_timestamp()
    from candidates where target.id=candidates.id returning target.*;
end
$function$;
revoke all on function runtime.claim_job(text,text,integer,integer,text) from public;
grant execute on function runtime.claim_job(text,text,integer,integer,text) to shopjob,shopprovider;

do $access$
declare target record;
begin
  for target in
    select table_schema,table_name from information_schema.tables
    where table_type='BASE TABLE' and table_schema in('runtime','extension','channel','catalog','pricing','inventory','fulfillment','ordering','organization','finance','audit')
  loop
    execute format('grant select,insert,update,delete on table %I.%I to shopprovider',target.table_schema,target.table_name);
    if exists(select 1 from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname=target.table_schema and relation.relname=target.table_name and relation.relrowsecurity)
      and not exists(select 1 from pg_policies where schemaname=target.table_schema and tablename=target.table_name and policyname='providerscope') then
      execute format('create policy providerscope on %I.%I for all to shopprovider using(true) with check(true)',target.table_schema,target.table_name);
    end if;
  end loop;
end
$access$;

grant usage on schema runtime,extension,channel,catalog,pricing,inventory,fulfillment,ordering,organization,finance,audit to shopprovider;
grant execute on all functions in schema runtime,extension,channel,catalog,pricing,inventory,fulfillment,ordering,organization,finance,audit to shopprovider;

select runtime.record_migration_evidence('20260831016000',
  1,
  (select count(*) from information_schema.columns where table_schema='runtime' and table_name='job' and column_name='workload'),0,0,
  'create index concurrently if not exists runtime_job_workload_claim_live on runtime.job(workload,kind,state,priority,available_at,id);',
  'select workload,kind,state,count(*) from runtime.job group by workload,kind,state order by workload,kind,state;');
insert into runtime.schemaversion(version,checksum)
values('20260831016000',encode(public.digest('20260831016000_isolate_provider_workload','sha256'),'hex'));

do $assert$
begin
  if to_regclass('runtime.jobdefinition') is not null then raise exception 'DUPLICATE_JOB_CONFIGURATION_REMAINS'; end if;
  if exists(select 1 from runtime.job where kind='returnauthorize') then raise exception 'LEGACY_RETURN_JOB_REMAINS'; end if;
  if to_regprocedure('runtime.claim_job(text,text,integer,integer)') is not null then raise exception 'UNSCOPED_JOB_CLAIM_REMAINS'; end if;
  if not exists(select 1 from pg_roles where rolname='shopprovider' and not rolinherit) then raise exception 'PROVIDER_ROLE_INVALID'; end if;
end
$assert$;

commit;
