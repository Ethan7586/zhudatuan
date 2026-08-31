begin;

do $precondition$ begin
  if not exists(select 1 from runtime.schemaversion where version='20260829111000') then raise exception 'ORGANIZATION_DIRECTORY_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260829112000') then raise exception 'ORGANIZATION_DIRECTORY_ALREADY_APPLIED'; end if;
end $precondition$;

create table organization.directoryconnection(
  id uuid primary key,
  tenant_id uuid not null,
  organization_id text not null references organization.organization(id),
  provider_instance_id uuid not null references identity.provider(id),
  secret_ref text not null check(secret_ref~'^[a-z][a-z0-9./]{2,127}$'),
  cursor_ciphertext text,
  successful_version bigint not null default 0 check(successful_version>=0),
  status text not null check(status in('draft','enabled','paused','disabled','revoked')),
  version bigint not null default 0 check(version>=0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create unique index organization_directoryconnection_active on organization.directoryconnection(tenant_id,provider_instance_id) where status<>'revoked';
create table organization.directorysubject(
  id uuid primary key,
  connection_id uuid not null references organization.directoryconnection(id),
  subject_hash bytea not null,
  type text not null check(type in('user','department')),
  status text not null check(status in('active','inactive','deleted','conflict')),
  attributes_ciphertext text,
  source_version bigint not null check(source_version>=0),
  missing_count smallint not null default 0 check(missing_count between 0 and 2),
  version bigint not null default 0 check(version>=0),
  first_seen_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  unique(connection_id,subject_hash)
);
create table organization.directorymembership(
  id uuid primary key,
  connection_id uuid not null references organization.directoryconnection(id),
  subject_id uuid not null references organization.directorysubject(id),
  organization_id text not null references organization.organization(id),
  membership_id text,
  status text not null check(status in('active','inactive','pending','conflict')),
  effective_at timestamptz not null,
  expires_at timestamptz,
  source_version bigint not null check(source_version>=0),
  version bigint not null default 0 check(version>=0),
  unique(connection_id,subject_id,organization_id),
  check(expires_at is null or expires_at>effective_at)
);
create table organization.syncrun(
  id uuid primary key,
  connection_id uuid not null references organization.directoryconnection(id),
  provider_run_id text not null,
  mode text not null check(mode in('full','incremental','event','reconcile')),
  state text not null check(state in('queued','running','completed','failed','cancelled')),
  cursor_ciphertext text,
  checksum char(64),
  read_count bigint not null default 0 check(read_count>=0),
  applied_count bigint not null default 0 check(applied_count>=0),
  conflict_count bigint not null default 0 check(conflict_count>=0),
  ignored_count bigint not null default 0 check(ignored_count>=0),
  error_summary text,
  watermark timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique(connection_id,provider_run_id),
  check(applied_count+conflict_count+ignored_count<=read_count)
);
create table organization.directoryinbox(
  connection_id uuid not null references organization.directoryconnection(id),
  provider_event_id text not null,
  provider_version bigint not null check(provider_version>=0),
  body_hash char(64) not null check(body_hash~'^[0-9a-f]{64}$'),
  envelope_ciphertext text,
  state text not null check(state in('received','processed','failed','stale')),
  received_at timestamptz not null default clock_timestamp(),
  processed_at timestamptz,
  primary key(connection_id,provider_event_id)
);
create index organization_directorysubject_active on organization.directorysubject(connection_id,status,source_version,id);
create index organization_directorymembership_active on organization.directorymembership(connection_id,status,source_version,id);
create index organization_syncrun_claim on organization.syncrun(state,created_at,id) where state in('queued','running');
create index organization_directoryinbox_pending on organization.directoryinbox(state,received_at,connection_id,provider_event_id) where processed_at is null;

select runtime.record_migration_evidence('20260829112000',0,0,0,0,
  'create index concurrently if not exists organization_directorysubject_active_live on organization.directorysubject(connection_id,status,source_version,id);',
  'select connection_id,provider_event_id,count(*) from organization.directoryinbox group by connection_id,provider_event_id having count(*)>1;');
insert into runtime.schemaversion(version,checksum) values('20260829112000',encode(public.digest('20260829112000_add_organization_directory','sha256'),'hex'));

commit;
