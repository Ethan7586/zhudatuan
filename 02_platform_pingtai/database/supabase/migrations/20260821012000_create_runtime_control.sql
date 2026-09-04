begin;

create table runtime.schemaversion(
  version text primary key,
  checksum char(64) not null check(checksum~'^[0-9a-f]{64}$'),
  applied_at timestamptz not null default clock_timestamp()
);

create table runtime.operation(
  id text primary key check(id~'^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$'),
  owner text not null,
  method text not null check(method in('GET','POST','PUT','PATCH','DELETE')),
  path text not null,
  contract_version text not null,
  unique(method,path)
);

create table runtime.event(
  type text not null,
  version integer not null check(version>0),
  owner text not null,
  schema_ref text not null,
  primary key(type,version)
);

create table runtime.idempotency(
  scope text not null,
  actor_id text not null,
  key text not null,
  request_hash char(64) not null,
  state text not null check(state in('started','completed','failed')),
  response jsonb,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  primary key(scope,actor_id,key)
);

create table runtime.outbox(
  id text primary key,
  event_type text not null,
  event_version integer not null check(event_version>0),
  aggregate_type text not null,
  aggregate_id text not null,
  scope_id text not null,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  trace_id text not null,
  occurred_at timestamptz not null,
  available_at timestamptz not null,
  claimed_by text,
  claim_until timestamptz,
  attempts integer not null default 0 check(attempts>=0),
  published_at timestamptz,
  failed_at timestamptz,
  error_code text
);

create table runtime.inbox(
  consumer text not null,
  event_id text not null,
  event_type text not null,
  event_version integer not null check(event_version>0),
  trace_id text not null,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  received_at timestamptz not null,
  processed_at timestamptz,
  attempts integer not null default 0 check(attempts>=0),
  primary key(consumer,event_id)
);

create table runtime.rawenvelope(
  provider text not null,
  external_id text not null,
  sha256 char(64) not null check(sha256~'^[0-9a-f]{64}$'),
  headers jsonb not null check(jsonb_typeof(headers)='object'),
  payload text not null,
  trace_id text not null,
  received_at timestamptz not null,
  primary key(provider,external_id),
  unique(provider,sha256)
);

create table runtime.deadletter(
  id text primary key,
  kind text not null,
  source_id text not null,
  owner text not null,
  payload jsonb not null,
  error_code text not null,
  attempts integer not null check(attempts>0),
  failed_at timestamptz not null,
  reviewed_at timestamptz,
  unique(kind,source_id)
);

create table runtime.lease(
  resource text primary key,
  owner text not null,
  token text not null unique,
  acquired_at timestamptz not null,
  deadline timestamptz not null,
  version bigint not null default 0 check(version>=0)
);

create table runtime.job(
  id text primary key,
  kind text not null,
  owner text not null,
  scope_id text,
  payload jsonb not null default '{}'::jsonb,
  state text not null check(state in('queued','running','completed','failed','cancelled')),
  priority integer not null default 100,
  available_at timestamptz not null,
  lease_owner text,
  lease_deadline timestamptz,
  attempts integer not null default 0 check(attempts>=0),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table runtime.projectionoffset(
  projection text not null,
  shard text not null,
  offset_value text not null,
  watermark timestamptz not null,
  version bigint not null check(version>=0),
  primary key(projection,shard)
);

-- Offline cutover staging. The migration process writes only KMS ciphertext,
-- blind indexes and key versions here; plaintext voucher codes are never
-- accepted by the target schema. This table is dropped by the legacy cleanup.
create table runtime.vouchersecretstage(
  voucher_id text primary key,
  code_ciphertext text not null,
  code_fingerprint char(64) not null unique check(code_fingerprint~'^[0-9a-f]{64}$'),
  key_version text not null,
  staged_at timestamptz not null
);

-- The legacy store table contains plaintext addresses.  The migration
-- executable must encrypt them with the configured KMS before SQL backfill
-- starts.  Keeping this separate from the domain table makes it impossible
-- for the schema migration to silently relabel plaintext as ciphertext.
create table runtime.partneraddressstage(
  store_id text primary key,
  address_ciphertext text not null,
  address_token char(64) not null check(address_token~'^[0-9a-f]{64}$'),
  key_version text not null,
  staged_at timestamptz not null
);
create table runtime.distributorcontactstage(
  distributor_id text primary key,
  contact_ciphertext text not null,
  contact_token char(64) not null check(contact_token~'^[0-9a-f]{64}$'),
  key_version text not null,
  staged_at timestamptz not null
);
create table runtime.wechatidentitystage(
  identity_id text primary key,
  subject_ciphertext text not null,
  subject_token char(64) not null check(subject_token~'^[0-9a-f]{64}$'),
  union_token char(64) check(union_token~'^[0-9a-f]{64}$'),
  key_version text not null,
  staged_at timestamptz not null
);

create or replace function runtime.claim_job(p_kind text,p_owner text,p_limit integer,p_lease_seconds integer)
returns setof runtime.job
language plpgsql security definer
set search_path=runtime,pg_temp as $$
begin
  if p_limit not between 1 and 1000 or p_lease_seconds not between 5 and 900 then
    raise exception 'JOB_CLAIM_ARGUMENT_INVALID';
  end if;
  return query
  with candidates as (
    select id from runtime.job
    where kind=p_kind and state='queued' and available_at<=clock_timestamp()
    order by priority,available_at,id
    for update skip locked limit p_limit
  )
  update runtime.job target
  set state='running',lease_owner=p_owner,
      lease_deadline=clock_timestamp()+make_interval(secs=>p_lease_seconds),
      attempts=target.attempts+1,updated_at=clock_timestamp()
  from candidates where target.id=candidates.id
  returning target.*;
end $$;

alter table runtime.idempotency enable row level security;
alter table runtime.outbox enable row level security;
alter table runtime.inbox enable row level security;
alter table runtime.rawenvelope enable row level security;
alter table runtime.deadletter enable row level security;
alter table runtime.lease enable row level security;
alter table runtime.job enable row level security;
alter table runtime.projectionoffset enable row level security;
alter table runtime.vouchersecretstage enable row level security;
alter table runtime.partneraddressstage enable row level security;
alter table runtime.distributorcontactstage enable row level security;
alter table runtime.wechatidentitystage enable row level security;

commit;
