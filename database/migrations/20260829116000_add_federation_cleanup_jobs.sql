begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829115000') then raise exception 'FEDERATION_JOBS_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829116000') then raise exception 'FEDERATION_JOBS_ALREADY_APPLIED'; end if;
end $precondition$;

create table runtime.jobdefinition(
  kind text primary key,
  owner text not null,
  queue text not null,
  concurrency integer not null check(concurrency between 1 and 128),
  timeout_ms integer not null check(timeout_ms between 1000 and 600000),
  retry_attempts integer not null check(retry_attempts between 1 and 32),
  lease_seconds integer not null check(lease_seconds between 1 and 900),
  resource_lease boolean not null,
  dead_letter text not null check(dead_letter='runtime.deadletter'),
  runbook text not null,
  version bigint not null default 1 check(version>0)
);
create table identity.providerhealth(
  provider_id uuid primary key references identity.provider(id) on delete cascade,
  status text not null check(status in('healthy','degraded','unavailable')),
  latency_ms integer not null check(latency_ms between 0 and 30000),
  error_code text,
  checked_at timestamptz not null,
  version bigint not null check(version>0)
);
insert into runtime.jobdefinition(kind,owner,queue,concurrency,timeout_ms,retry_attempts,lease_seconds,resource_lease,dead_letter,runbook) values
  ('directorysync','organization','identity',8,120000,8,180,true,'runtime.deadletter','docs/operations/directorysync.md'),
  ('directoryreconcile','organization','maintenance',2,300000,5,360,true,'runtime.deadletter','docs/operations/directoryreconcile.md'),
  ('federationcleanup','identity','maintenance',2,60000,8,90,false,'runtime.deadletter','docs/operations/federationcleanup.md'),
  ('providerhealth','identity','identity',8,30000,3,60,true,'runtime.deadletter','docs/operations/providerhealth.md');
alter table runtime.jobdefinition enable row level security;
alter table runtime.jobdefinition force row level security;
alter table identity.providerhealth enable row level security;
alter table identity.providerhealth force row level security;
create policy jobdefinitionapp on runtime.jobdefinition for select to shopapp using(true);
create policy jobdefinitionjob on runtime.jobdefinition for select to shopjob using(true);
create policy providerhealthapp on identity.providerhealth for select to shopapp using(exists(select 1 from identity.provider provider
  where provider.id=provider_id and provider.tenant_id::text=nullif(current_setting('app.tenant_id',true),'')));
create policy providerhealthjob on identity.providerhealth for all to shopjob using(true) with check(true);
grant select on runtime.jobdefinition to shopapp,shopjob;
grant select on identity.providerhealth to shopapp;
grant select,insert,update on identity.providerhealth to shopjob;
revoke all on runtime.jobdefinition from public;
revoke all on identity.providerhealth from public;

create index runtime_job_resource_lease on runtime.job(kind,(payload->>'resource')) where state in('queued','running');

select runtime.record_migration_evidence('20260829116000',4,(select count(*) from runtime.jobdefinition),0,0,
  'create index concurrently if not exists runtime_job_resource_lease_live on runtime.job(kind,(payload->>''resource'')) where state in(''queued'',''running'');',
  'select kind,owner,queue,concurrency,timeout_ms,retry_attempts,lease_seconds from runtime.jobdefinition order by kind;');
insert into runtime.schemaversion(version,checksum) values('20260829116000',encode(public.digest('20260829116000_add_federation_cleanup_jobs','sha256'),'hex'));

commit;
