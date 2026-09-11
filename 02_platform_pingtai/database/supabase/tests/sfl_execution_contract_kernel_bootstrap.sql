create role zhudatuanpurchaseapi nologin;
create role zhudatuanwebapi nologin;
create schema access;
create schema runtime;

create function access.web_scope_allowed(text) returns boolean language sql stable as $$ select true $$;

create table runtime.idempotency(
  scope text not null,
  actor_id text not null,
  key text not null,
  request_hash char(64) not null,
  state text not null,
  response jsonb,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  primary key(scope,actor_id,key)
);

create table runtime.outbox(
  id text primary key,
  event_type text not null,
  event_version integer not null,
  aggregate_type text not null,
  aggregate_id text not null,
  scope_id text not null,
  payload jsonb not null,
  trace_id text not null,
  occurred_at timestamptz not null,
  available_at timestamptz not null
);
alter table runtime.outbox enable row level security;

create table runtime.event(
  type text not null,
  version integer not null,
  owner text not null,
  schema_ref text not null,
  primary key(type,version)
);

grant usage on schema access,runtime to zhudatuanpurchaseapi,zhudatuanwebapi;
grant select,insert on runtime.idempotency to zhudatuanpurchaseapi;
