begin;

create table extension.manifest(
  id text not null,
  version text not null,
  kind text not null,
  contract_version text not null,
  manifest jsonb not null check(jsonb_typeof(manifest)='object'),
  manifest_hash char(64) not null,
  signature text not null,
  registered_at timestamptz not null,
  primary key(id,version),
  unique(manifest_hash)
);
create table extension.installation(
  id text primary key,
  extension_id text not null,
  extension_version text not null,
  scope_id text not null,
  status text not null check(status in('draft','testing','enabled','degraded','disabled')),
  manifest jsonb not null check(jsonb_typeof(manifest)='object'),
  base_url text,
  endpoints jsonb not null default '{}'::jsonb check(jsonb_typeof(endpoints)='object'),
  secret_ref text,
  health_operation text,
  version bigint not null default 0,
  installed_at timestamptz not null,
  unique(extension_id,scope_id),
  foreign key(extension_id,extension_version) references extension.manifest(id,version),
  check((extension_id='private') or (base_url is not null and secret_ref is not null and health_operation is not null))
);
create table extension.health(
  installation_id text not null references extension.installation(id),
  checked_at timestamptz not null,
  connection_version bigint not null check(connection_version>=0),
  state text not null check(state in('healthy','degraded','unavailable')),
  latency_ms integer check(latency_ms is null or latency_ms>=0),
  reason text,
  primary key(installation_id,checked_at)
);
create table extension.contractversion(
  extension_id text not null,
  contract_version text not null,
  schema_hash char(64) not null,
  sandbox_evidence_ref text,
  status text not null check(status in('designed','verified','retired')),
  primary key(extension_id,contract_version)
);
create table extension.activationhistory(
  installation_id text not null references extension.installation(id),
  sequence bigint not null,
  previous_state text,
  next_state text not null,
  actor_id text not null,
  evidence jsonb not null,
  occurred_at timestamptz not null,
  primary key(installation_id,sequence)
);

do $$ declare item record; begin for item in select tablename from pg_tables where schemaname='extension' loop execute format('alter table extension.%I enable row level security',item.tablename); end loop; end $$;
commit;
