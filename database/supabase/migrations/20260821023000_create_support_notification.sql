begin;

create table support.case(
  id text primary key,
  scope_id text not null,
  member_id text,
  order_id text,
  channel text not null,
  priority text not null check(priority in('low','normal','high','urgent')),
  state text not null check(state in('open','assigned','waiting','resolved','closed')),
  subject text not null,
  assigned_agent_id text,
  response_due_at timestamptz not null,
  resolution_due_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null default 0
);
create table support.message(
  id text primary key,
  case_id text not null references support.case(id),
  author_type text not null check(author_type in('member','agent','system')),
  author_id text,
  body_ciphertext text not null,
  body_hash char(64) not null,
  body_key_version text not null,
  created_at timestamptz not null
);
create table support.caseevent(
  case_id text not null references support.case(id),
  sequence bigint not null,
  kind text not null,
  actor_id text not null,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  occurred_at timestamptz not null,
  primary key(case_id,sequence)
);
create table support.assignment(
  id text primary key,
  case_id text not null references support.case(id),
  agent_id text not null,
  reason text not null,
  assigned_at timestamptz not null,
  released_at timestamptz
);
create table support.agent(
  id text primary key,
  scope_id text not null,
  membership_id text not null,
  skills jsonb not null check(jsonb_typeof(skills)='array'),
  capacity integer not null check(capacity>0),
  state text not null check(state in('offline','available','busy','disabled')),
  unique(scope_id,membership_id)
);
create table support.account(
  id text primary key,
  scope_id text not null,
  channel text not null check(channel in('inapp','wechat','email','sms')),
  external_ref text not null,
  secret_ref text,
  state text not null check(state in('active','disabled')),
  version bigint not null default 0,
  unique(scope_id,channel,external_ref)
);
create table support.sla(
  id text primary key,
  scope_id text not null,
  priority text not null,
  response_seconds integer not null check(response_seconds>0),
  resolution_seconds integer not null check(resolution_seconds>0),
  version integer not null check(version>0),
  unique(scope_id,priority,version)
);
create table support.evidence(
  id text primary key,
  case_id text not null references support.case(id),
  object_ref text not null,
  sha256 char(64) not null,
  kind text not null,
  size_bytes bigint not null check(size_bytes>0 and size_bytes<=10485760),
  state text not null check(state in('pending','clean','rejected')),
  created_at timestamptz not null
);
create table support.escalation(
  id text primary key,
  case_id text not null references support.case(id),
  reason text not null,
  target text not null,
  state text not null check(state in('open','accepted','resolved')),
  created_at timestamptz not null,
  resolved_at timestamptz
);
create unique index support_escalation_once on support.escalation(case_id,reason);

create table notification.template(
  id text primary key,
  scope_id text not null,
  channel text not null check(channel in('sms','email','wechat','inapp')),
  event_type text not null,
  version integer not null check(version>0),
  variable_schema jsonb not null check(jsonb_typeof(variable_schema)='object'),
  provider_template text,
  subject text,
  body text not null,
  status text not null check(status in('draft','active','retired')),
  unique(scope_id,channel,event_type,version)
);
create table notification.preference(
  member_id text not null,
  channel text not null,
  event_type text not null,
  enabled boolean not null,
  updated_at timestamptz not null,
  primary key(member_id,channel,event_type)
);
create table notification.endpoint(
  member_id text not null,
  channel text not null check(channel in('sms','email','wechat')),
  address_ciphertext text not null,
  address_token char(64) not null,
  address_key_version text not null,
  consent_at timestamptz not null,
  revoked_at timestamptz,
  primary key(member_id,channel)
);
create table notification.dispatch(
  id text primary key,
  template_id text not null references notification.template(id),
  recipient_token char(64) not null,
  recipient_ciphertext text,
  recipient_key_version text,
  recipient_ref text,
  payload jsonb not null,
  state text not null check(state in('queued','sending','sent','failed','cancelled')),
  idempotency_key text not null unique,
  available_at timestamptz not null,
  created_at timestamptz not null,
  check((recipient_ciphertext is not null)<>(recipient_ref is not null)),
  check((recipient_ciphertext is null)=(recipient_key_version is null))
);
create table notification.attempt(
  id text not null,
  dispatch_id text not null references notification.dispatch(id),
  provider text not null,
  external_id text,
  state text not null,
  error_code text,
  attempted_at timestamptz not null,
  primary key(id,attempted_at)
) partition by range(attempted_at);
create table notification.attemptdefault partition of notification.attempt default;

do $$ declare item record; begin for item in select schemaname,tablename from pg_tables where schemaname in('support','notification') loop execute format('alter table %I.%I enable row level security',item.schemaname,item.tablename); end loop; end $$;
commit;
