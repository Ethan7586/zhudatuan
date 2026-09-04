begin;

create table finance.account(
  id text primary key,
  scope_id text not null,
  code text not null,
  currency char(3) not null,
  kind text not null check(kind in('asset','liability','equity','income','expense')),
  status text not null check(status in('active','closed')),
  unique(scope_id,code,currency)
);
create table finance.journal(
  id text primary key,
  reference_type text not null,
  reference_id text not null,
  currency char(3) not null,
  period text not null,
  state text not null check(state in('draft','posted','reversed')),
  description text not null,
  posted_at timestamptz,
  version bigint not null default 0,
  unique(reference_type,reference_id)
);
create table finance.entry(
  id text primary key,
  journal_id text not null references finance.journal(id),
  account_id text not null references finance.account(id),
  side text not null check(side in('debit','credit')),
  amount_minor bigint not null check(amount_minor>0),
  created_at timestamptz not null
);
create table finance.period(
  scope_id text not null,
  period text not null,
  state text not null check(state in('open','closing','closed')),
  closed_at timestamptz,
  closed_by text,
  primary key(scope_id,period)
);
create table finance.reconciliation(
  id text primary key,
  scope_id text not null,
  provider text not null,
  partner_id text not null,
  period text not null,
  statement_ref text not null,
  statement_hash char(64) not null,
  state text not null check(state in('received','matching','balanced','difference','approved')),
  debit_minor bigint not null default 0,
  credit_minor bigint not null default 0,
  difference_minor bigint not null default 0,
  created_by text not null,
  approved_by text,
  evidence jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence)='object'),
  unique(provider,period,statement_hash)
);
create table finance.settlement(
  id text primary key,
  partner_id text not null,
  period text not null,
  reconciliation_id text not null references finance.reconciliation(id),
  amount_minor bigint not null,
  currency char(3) not null,
  state text not null check(state in('draft','approved','payable','paid','cancelled')),
  unique(partner_id,period)
);
create table finance.policy(
  id text primary key,
  scope_id text not null,
  kind text not null,
  rule jsonb not null check(jsonb_typeof(rule)='object'),
  state text not null check(state in('draft','active','retired')),
  version bigint not null default 0,
  unique(scope_id,kind)
);
create table finance.statement(
  id text primary key,
  scope_id text not null,
  period_start date not null,
  period_end date not null,
  currency char(3) not null,
  opening_minor bigint not null,
  debit_minor bigint not null check(debit_minor>=0),
  credit_minor bigint not null check(credit_minor>=0),
  closing_minor bigint not null,
  state text not null check(state in('draft','final','replaced')),
  object_ref text,
  sha256 char(64),
  generated_at timestamptz not null,
  unique(scope_id,period_start,period_end,currency,state)
);

create table invoice.profile(
  id text primary key,
  owner_id text not null,
  title_ciphertext text not null,
  title_key_version text not null,
  taxid_ciphertext text not null,
  taxid_token char(64) not null,
  taxid_key_version text not null,
  address_ciphertext text,
  address_key_version text,
  status text not null check(status in('active','deleted')),
  version bigint not null default 0
  ,check((address_ciphertext is null)=(address_key_version is null))
);
create table invoice.request(
  id text primary key,
  profile_id text not null references invoice.profile(id),
  settlement_id text,
  amount_minor bigint not null check(amount_minor>0),
  currency char(3) not null,
  state text not null check(state in('submitted','reviewing','issued','rejected','cancelled')),
  created_at timestamptz not null,
  version bigint not null default 0
);
create table invoice.document(
  id text primary key,
  request_id text not null unique references invoice.request(id),
  provider text not null,
  external_id text not null,
  object_ref text not null,
  sha256 char(64) not null,
  issued_at timestamptz not null,
  unique(provider,external_id)
);
create table invoice.line(
  request_id text not null references invoice.request(id),
  sequence integer not null,
  description text not null,
  amount_minor bigint not null check(amount_minor>0),
  tax_minor bigint not null check(tax_minor>=0),
  primary key(request_id,sequence)
);
create table invoice.statusevent(
  request_id text not null references invoice.request(id),
  sequence integer not null,
  state text not null,
  reason text,
  occurred_at timestamptz not null,
  primary key(request_id,sequence)
);

create table channel.connection(
  id text primary key,
  provider text not null,
  scope_id text not null,
  status text not null check(status in('draft','testing','enabled','degraded','disabled')),
  contract_version text not null,
  secret_ref text,
  configuration jsonb not null check(jsonb_typeof(configuration)='object'),
  connection_timeout_ms integer not null check(connection_timeout_ms between 1 and 30000),
  response_timeout_ms integer not null check(response_timeout_ms between 1 and 120000),
  total_deadline_ms integer not null check(total_deadline_ms between 1 and 300000),
  max_concurrency integer not null check(max_concurrency between 1 and 64),
  requests_per_second numeric(12,3) not null check(requests_per_second>0),
  max_attempts integer not null check(max_attempts between 1 and 5),
  failure_threshold integer not null check(failure_threshold between 1 and 100),
  recovery_ms integer not null check(recovery_ms between 100 and 3600000),
  region text not null,
  version bigint not null default 0,
  unique(provider,scope_id)
);
create table channel.distributor(
  id text primary key,
  organization_id text not null,
  code text not null unique,
  name text not null,
  contact_ciphertext text,
  contact_token char(64),
  contact_key_version text,
  settlement_mode text not null,
  metadata jsonb not null check(jsonb_typeof(metadata)='object'),
  status text not null check(status in('draft','active','suspended','terminated')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check((contact_ciphertext is null)=(contact_token is null)),
  check((contact_ciphertext is null)=(contact_key_version is null))
);
create table channel.tenantbinding(
  id text primary key,
  distributor_id text not null references channel.distributor(id),
  tenant_id text not null,
  state text not null check(state in('draft','active','expired','terminated')),
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  effective_at timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(distributor_id,tenant_id,effective_at)
);
create table channel.syncrun(
  id text primary key,
  connection_id text not null references channel.connection(id),
  kind text not null,
  state text not null check(state in('queued','running','completed','failed','cancelled')),
  cursor_value text,
  input_hash char(64) not null,
  input jsonb not null check(jsonb_typeof(input)='object'),
  error_summary jsonb not null default '[]'::jsonb check(jsonb_typeof(error_summary)='array'),
  watermark timestamptz,
  pulled_count bigint not null default 0,
  accepted_count bigint not null default 0,
  rejected_count bigint not null default 0,
  started_at timestamptz,
  completed_at timestamptz
);
create unique index channel_syncrun_active on channel.syncrun(connection_id,kind) where state in('queued','running');
create table channel.externalobject(
  id text primary key,
  provider text not null,
  objecttype text not null,
  externalid text not null,
  internaltype text not null,
  internalid text not null,
  sourceversion text not null,
  mapped_at timestamptz not null,
  unique(provider,objecttype,externalid)
);
create table channel.sourcerecord(
  id text primary key,
  provider text not null,
  scope_id text not null,
  objecttype text not null,
  externalid text not null,
  sourceversion text not null,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  payload_hash char(64) not null,
  disposition text not null check(disposition in('received','accepted','rejected')),
  observed_at timestamptz not null,
  unique(provider,objecttype,externalid,sourceversion)
);
create table channel.provideroperation(
  id text primary key,
  provider text not null,
  scope_id text not null,
  kind text not null,
  idempotency_key text not null,
  internal_reference text not null,
  external_reference text,
  state text not null check(state in('queued','submitted','processing','succeeded','failed','unknown')),
  request_hash char(64) not null,
  response jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(provider,kind,idempotency_key),
  unique(provider,kind,external_reference)
);
create table channel.statement(
  id text primary key,
  connection_id text not null references channel.connection(id),
  provider text not null,
  scope_id text not null,
  partner_id text not null,
  period_start date not null,
  period_end date not null,
  timezone text not null,
  object_ref text not null,
  sha256 char(64) not null,
  generated_at timestamptz not null,
  unique(connection_id,period_start,period_end)
);

create or replace function finance.enforce_balanced_journal() returns trigger
language plpgsql set search_path=finance,pg_temp as $$
declare debit bigint; credit bigint;
begin
  if new.state='posted' and old.state<>'posted' then
    select coalesce(sum(amount_minor) filter(where side='debit'),0),coalesce(sum(amount_minor) filter(where side='credit'),0)
    into debit,credit from finance.entry where journal_id=new.id;
    if debit=0 or debit<>credit then raise exception 'FINANCE_JOURNAL_UNBALANCED'; end if;
    new.posted_at=clock_timestamp();
  end if;
  return new;
end $$;
create trigger finance_journal_balance before update of state on finance.journal for each row execute function finance.enforce_balanced_journal();

do $$ declare item record; begin for item in select schemaname,tablename from pg_tables where schemaname in('finance','invoice','channel') loop execute format('alter table %I.%I enable row level security',item.schemaname,item.tablename); end loop; end $$;
commit;
