begin;

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion where version='20260904010000') then raise exception 'RUNTIME_TASKS_PREVIOUS_HEAD_MISSING'; end if;
  if exists(select 1 from runtime.schemaversion where version='20260904011000') then raise exception 'RUNTIME_TASKS_ALREADY_APPLIED'; end if;
end
$precondition$;

create table runtime.jobs(
  id text primary key check(id~'^job:'),
  tenant_id text not null,
  scope_id text not null,
  kind text not null check(kind~'^[a-z][a-z0-9]+$'),
  owner text not null check(owner~'^[a-z]+$'),
  queue text not null check(queue~'^[a-z]+$'),
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  state text not null check(state in('queued','running','succeeded','failed','cancelled','deadlettered')),
  priority integer not null check(priority between 0 and 1000),
  available_at timestamptz not null,
  lease_owner text,
  lease_deadline timestamptz,
  fencing_token bigint not null default 0 check(fencing_token>=0),
  checkpoint jsonb not null default '{}'::jsonb check(jsonb_typeof(checkpoint)='object'),
  progress integer not null default 0 check(progress between 0 and 100),
  cancel_requested_at timestamptz,
  attempts integer not null default 0 check(attempts>=0),
  idempotency_key text not null,
  retention_until timestamptz not null,
  version bigint not null check(version>0),
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,owner,idempotency_key),
  check((state='running')=(lease_owner is not null and lease_deadline is not null)),
  check(retention_until>created_at)
);

create table runtime.job_attempts(
  id text primary key check(id~'^jobattempt:'),
  tenant_id text not null,
  scope_id text not null,
  job_id text not null references runtime.jobs(id),
  attempt integer not null check(attempt>0),
  fencing_token bigint not null check(fencing_token>0),
  worker_id text not null,
  state text not null check(state in('running','succeeded','failed','cancelled')),
  error_code text,
  error_detail jsonb not null default '{}'::jsonb check(jsonb_typeof(error_detail)='object'),
  started_at timestamptz not null,
  finished_at timestamptz,
  unique(job_id,attempt),
  check((state='running')=(finished_at is null))
);

create table runtime.leases(
  resource text primary key,
  tenant_id text not null,
  scope_id text not null,
  owner text not null,
  token text not null unique,
  fencing_token bigint not null check(fencing_token>0),
  acquired_at timestamptz not null,
  heartbeat_at timestamptz not null,
  deadline timestamptz not null,
  version bigint not null check(version>0),
  check(deadline>acquired_at and heartbeat_at>=acquired_at)
);

create table runtime.imports(
  id text primary key check(id~'^import:'),
  tenant_id text not null,
  scope_id text not null,
  owner text not null check(owner~'^[a-z]+$'),
  kind text not null check(kind~'^[a-z][a-z0-9]+$'),
  object_key text not null,
  file_hash char(64) not null check(file_hash~'^[0-9a-f]{64}$'),
  file_name text not null check(length(file_name) between 1 and 255),
  media_type text not null,
  size_bytes bigint not null check(size_bytes>0),
  state text not null check(state in('uploaded','scanning','rejected','preflight','ready','running','succeeded','failed','cancelled')),
  rows_total bigint check(rows_total>=0),
  rows_processed bigint not null default 0 check(rows_processed>=0),
  rows_succeeded bigint not null default 0 check(rows_succeeded>=0),
  rows_failed bigint not null default 0 check(rows_failed>=0),
  checkpoint jsonb not null default '{}'::jsonb check(jsonb_typeof(checkpoint)='object'),
  error_report_key text,
  idempotency_key text not null,
  version bigint not null check(version>0),
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  retention_until timestamptz not null,
  unique(scope_id,owner,kind,file_hash),
  unique(scope_id,owner,idempotency_key),
  check(rows_processed=rows_succeeded+rows_failed),
  check(rows_total is null or rows_processed<=rows_total),
  check(retention_until>created_at)
);

create table runtime.import_chunks(
  id text primary key check(id~'^importchunk:'),
  tenant_id text not null,
  scope_id text not null,
  import_id text not null references runtime.imports(id),
  sequence integer not null check(sequence>=0),
  row_start bigint not null check(row_start>=1),
  row_end bigint not null check(row_end>=row_start),
  payload_hash char(64) not null check(payload_hash~'^[0-9a-f]{64}$'),
  state text not null check(state in('pending','running','succeeded','failed')),
  fencing_token bigint check(fencing_token>0),
  checkpoint jsonb not null default '{}'::jsonb check(jsonb_typeof(checkpoint)='object'),
  error_count integer not null default 0 check(error_count>=0),
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(import_id,sequence),
  unique(import_id,row_start,row_end)
);

create table runtime.exports(
  id text primary key check(id~'^export:'),
  tenant_id text not null,
  scope_id text not null,
  owner text not null check(owner~'^[a-z]+$'),
  kind text not null check(kind~'^[a-z][a-z0-9]+$'),
  filter_snapshot jsonb not null check(jsonb_typeof(filter_snapshot)='object'),
  authorization_snapshot jsonb not null check(jsonb_typeof(authorization_snapshot)='object'),
  state text not null check(state in('queued','running','ready','failed','expired','cancelled')),
  object_key text,
  object_hash char(64) check(object_hash~'^[0-9a-f]{64}$'),
  rows_exported bigint not null default 0 check(rows_exported>=0),
  download_token_hash bytea,
  download_expires_at timestamptz,
  downloaded_at timestamptz,
  idempotency_key text not null,
  version bigint not null check(version>0),
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  retention_until timestamptz not null,
  unique(scope_id,owner,idempotency_key),
  check((state='ready')=(object_key is not null and object_hash is not null and download_token_hash is not null and download_expires_at is not null)),
  check(downloaded_at is null or downloaded_at<=retention_until)
);

create table runtime.deadletters(
  id text primary key check(id~'^deadletter:'),
  tenant_id text not null,
  scope_id text not null,
  source_kind text not null check(source_kind in('job','outbox','inbox','import','provider')),
  source_id text not null,
  owner text not null check(owner~'^[a-z]+$'),
  payload jsonb not null,
  error_code text not null,
  attempts integer not null check(attempts>0),
  state text not null check(state in('open','retrying','resolved','discarded')),
  retry_job_id text references runtime.jobs(id),
  resolution text,
  version bigint not null check(version>0),
  failed_at timestamptz not null,
  reviewed_by text,
  reviewed_at timestamptz,
  retention_until timestamptz not null,
  unique(source_kind,source_id),
  check((state='open')=(reviewed_at is null and reviewed_by is null))
);

create index runtime_jobs_claim on runtime.jobs(queue,kind,priority,available_at,id) include(owner,scope_id,attempts,fencing_token) where state='queued';
create index runtime_jobs_lease on runtime.jobs(lease_deadline,id) where state='running';
create index runtime_jobs_retention on runtime.jobs(retention_until,id) where state in('succeeded','failed','cancelled','deadlettered');
create index runtime_imports_scope on runtime.imports(scope_id,created_at desc,id) include(owner,kind,state,rows_processed,rows_total,version);
create index runtime_import_chunks_work on runtime.import_chunks(import_id,state,sequence) include(row_start,row_end,fencing_token,version);
create index runtime_exports_scope on runtime.exports(scope_id,created_at desc,id) include(owner,kind,state,version);
create index runtime_deadletters_open on runtime.deadletters(owner,failed_at,id) include(source_kind,source_id,error_code,attempts) where state='open';

do $security$
declare target text;
begin
  foreach target in array array['jobs','job_attempts','leases','imports','import_chunks','exports','deadletters'] loop
    execute format('alter table runtime.%I enable row level security',target);
    execute format('alter table runtime.%I force row level security',target);
    execute format('create policy migrationaccess on runtime.%I for all to shopmigration using(true) with check(true)',target);
    execute format('create policy appscope on runtime.%I for all to shopapp using(access.scope_allowed(scope_id)) with check(access.scope_allowed(scope_id))',target);
    execute format('create policy jobscope on runtime.%I for all to shopjob using(true) with check(true)',target);
    execute format('revoke all on table runtime.%I from public',target);
  end loop;
end
$security$;

grant usage on schema runtime to shopapp,shopjob;
grant select,insert,update on runtime.jobs,runtime.imports,runtime.exports to shopapp;
grant select,insert,update,delete on runtime.jobs,runtime.job_attempts,runtime.leases,runtime.imports,runtime.import_chunks,runtime.exports,runtime.deadletters to shopjob;

select runtime.record_migration_evidence(
  '20260904011000',7,7,0,0,
  'select state,count(*) from runtime.jobs group by state; select state,count(*) from runtime.imports group by state;',
  'select count(*) tables from information_schema.tables where table_schema=''runtime'' and table_name in(''jobs'',''job_attempts'',''leases'',''imports'',''import_chunks'',''exports'',''deadletters'');'
);

insert into runtime.schemaversion(version,checksum)
values('20260904011000',encode(public.digest('20260904011000_prepare_runtime_tasks','sha256'),'hex'));

do $assert$
begin
  if (select count(*) from information_schema.tables where table_schema='runtime' and table_name in('jobs','job_attempts','leases','imports','import_chunks','exports','deadletters'))<>7 then
    raise exception 'RUNTIME_TASK_TABLE_COUNT_INVALID';
  end if;
end
$assert$;

commit;
