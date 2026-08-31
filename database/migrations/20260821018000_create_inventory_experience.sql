begin;

create table inventory.stockitem(
  id text primary key,
  scope_id text not null,
  sku_id text not null,
  location_id text not null,
  onhand bigint not null check(onhand>=0),
  safety bigint not null default 0 check(safety>=0),
  version bigint not null default 0 check(version>=0),
  status text not null check(status in('active','blocked','retired')),
  updated_at timestamptz not null,
  unique(scope_id,sku_id,location_id)
);
create table inventory.reservation(
  id text primary key,
  stockitem_id text not null references inventory.stockitem(id),
  owner_type text not null,
  owner_id text not null,
  quantity bigint not null check(quantity>0),
  state text not null check(state in('active','committed','released','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null,
  version bigint not null default 0,
  unique(stockitem_id,owner_type,owner_id)
);
create table inventory.movement(
  id text primary key,
  stockitem_id text not null references inventory.stockitem(id),
  kind text not null check(kind in('receive','reserve','release','commit','adjust','return')),
  quantity_delta bigint not null check(quantity_delta<>0),
  reference_type text not null,
  reference_id text not null,
  occurred_at timestamptz not null,
  unique(stockitem_id,kind,reference_type,reference_id)
);
create table inventory.snapshot(
  stockitem_id text not null references inventory.stockitem(id),
  observed_at timestamptz not null,
  source text not null,
  onhand bigint not null check(onhand>=0),
  source_version text not null,
  primary key(stockitem_id,observed_at,source)
);
create table inventory.observation(
  id text primary key,
  stockitem_id text not null references inventory.stockitem(id),
  kind text not null check(kind in('stock','return')),
  source text not null,
  source_reference text not null,
  observed_onhand bigint check(observed_onhand is null or observed_onhand>=0),
  observed_quantity bigint check(observed_quantity is null or observed_quantity>0),
  disposition text not null check(disposition in('pending','accepted','rejected')),
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  observed_at timestamptz not null,
  recorded_at timestamptz not null,
  unique(stockitem_id,kind,source,source_reference),
  check((kind='stock' and observed_onhand is not null and observed_quantity is null)
    or (kind='return' and observed_onhand is null and observed_quantity is not null))
);
create table inventory.command(
  id text primary key,
  scope_id text not null,
  operation text not null check(operation in('reserve','commit','release','expire','restock')),
  idempotency_key text not null,
  request jsonb not null check(jsonb_typeof(request)='object'),
  response jsonb,
  created_at timestamptz not null,
  completed_at timestamptz,
  unique(scope_id,operation,idempotency_key),
  check((response is null)=(completed_at is null))
);
create table inventory.syncstate(
  scope_id text not null,
  source text not null,
  source_reference text not null,
  location_id text not null,
  cursor_value text,
  state text not null check(state in('queued','running','completed','partial','failed','dead')),
  observed_count bigint not null check(observed_count>=0),
  applied_count bigint not null check(applied_count>=0),
  failed_count bigint not null check(failed_count>=0),
  last_error text,
  version bigint not null,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null,
  primary key(scope_id,source,source_reference,location_id),
  check(applied_count+failed_count<=observed_count)
);
create table inventory.cutoverreview(
  id text primary key,
  stockitem_id text not null references inventory.stockitem(id),
  source_relation text not null,
  legacy_available bigint not null check(legacy_available>=0),
  legacy_reserved bigint not null check(legacy_reserved>=0),
  reason text not null,
  state text not null check(state in('open','approved','rejected')),
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  captured_at timestamptz not null,
  reviewed_at timestamptz,
  reviewed_by text,
  unique(stockitem_id,source_relation)
);

create table experience.application(
  id text primary key,
  scope_id text not null,
  name text not null,
  status text not null check(status in('draft','active','disabled')),
  head_version_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null default 0,
  unique(scope_id,name)
);
create table experience.version(
  id text primary key,
  application_id text not null references experience.application(id),
  sequence integer not null check(sequence>0),
  schema_version text not null,
  configuration jsonb not null check(jsonb_typeof(configuration)='object'),
  configuration_hash char(64) not null,
  validation_state text not null check(validation_state in('pending','valid','invalid')),
  created_by text not null,
  created_at timestamptz not null,
  unique(application_id,sequence)
);
alter table experience.application add constraint application_head_version_fk foreign key(head_version_id) references experience.version(id) deferrable initially deferred;
create table experience.release(
  id text primary key,
  application_id text not null references experience.application(id),
  version_id text not null references experience.version(id),
  state text not null check(state in('scheduled','active','retired','failed')),
  effective_at timestamptz not null,
  retired_at timestamptz,
  published_by text not null
);
create table experience.binding(
  application_id text not null references experience.application(id),
  domain text not null,
  mall_id text not null,
  pool_id text not null,
  primary key(application_id,domain)
);

create table marketing.campaign(
  id text primary key,
  scope_id text not null,
  kind text not null check(kind in('discount','coupon','lottery','affiliate')),
  name text not null,
  state text not null check(state in('draft','scheduled','active','paused','completed','cancelled')),
  budget_minor bigint not null check(budget_minor>=0),
  spent_minor bigint not null default 0 check(spent_minor>=0 and spent_minor<=budget_minor),
  currency char(3) not null,
  rule jsonb not null check(jsonb_typeof(rule)='object'),
  effective_at timestamptz not null,
  expires_at timestamptz,
  version bigint not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,name),
  check(expires_at is null or expires_at>effective_at)
);
create table marketing.redemption(
  id text primary key,
  campaign_id text not null references marketing.campaign(id),
  member_id text not null,
  order_id text,
  amount_minor bigint not null check(amount_minor>=0),
  state text not null check(state in('reserved','committed','released')),
  idempotency_key text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(campaign_id,member_id,idempotency_key)
);

do $$ declare item record; begin for item in select schemaname,tablename from pg_tables where schemaname in('inventory','experience','marketing') loop execute format('alter table %I.%I enable row level security',item.schemaname,item.tablename); end loop; end $$;
commit;
