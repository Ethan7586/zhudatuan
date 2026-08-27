begin;

create table fulfillment.fulfillmentorder(
  id text primary key,
  order_id text not null,
  suborder_id text not null,
  provider text,
  partner_id text,
  store_id text,
  kind text not null check(kind in('shipment','delivery','pickup','service','digital')),
  state text not null check(state in('pending','submitted','accepted','processing','ready','completed','cancelled','failed')),
  external_reference text,
  payment_id text,
  source_effect_id text,
  amount_minor bigint check(amount_minor is null or amount_minor>=0),
  idempotency_key text,
  created_at timestamptz,
  updated_at timestamptz,
  version bigint not null default 0,
  unique(provider,external_reference),
  unique(source_effect_id,suborder_id)
);
create table fulfillment.line(
  fulfillment_id text not null references fulfillment.fulfillmentorder(id),
  order_line_id text not null,
  quantity bigint not null check(quantity>0),
  primary key(fulfillment_id,order_line_id)
);
create table fulfillment.milestone(
  id text primary key,
  fulfillment_id text not null references fulfillment.fulfillmentorder(id),
  kind text not null,
  state text not null,
  external_id text,
  evidence jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  unique(fulfillment_id,kind,external_id)
);
create table fulfillment.returnrecord(
  id text primary key,
  aftersale_id text not null,
  fulfillment_id text not null references fulfillment.fulfillmentorder(id),
  state text not null check(state in('authorized','intransit','received','inspected','accepted','rejected')),
  tracking_number text,
  inspection jsonb,
  version bigint not null default 0
);

create table verification.session(
  id text primary key,
  scope_id text not null,
  subject_type text not null,
  subject_id text not null,
  purpose text not null,
  state text not null check(state in('issued','verified','expired','revoked','locked')),
  expires_at timestamptz not null,
  version bigint not null default 0
);
create table verification.nonce(
  session_id text not null references verification.session(id) on delete cascade,
  nonce_hash char(64) not null,
  issued_at timestamptz not null,
  consumed_at timestamptz,
  primary key(session_id,nonce_hash)
);
create table verification.device(
  id text primary key,
  scope_id text not null,
  label text not null,
  fingerprint_hash char(64) not null,
  public_key text,
  status text not null check(status in('trusted','blocked','retired')),
  version bigint not null default 0,
  unique(scope_id,fingerprint_hash)
);
create table verification.attempt(
  id text primary key,
  session_id text not null references verification.session(id),
  nonce_hash char(64) not null,
  device_id text references verification.device(id),
  result text not null check(result in('accepted','rejected','replayed','expired')),
  reason text not null,
  trace_id text not null,
  attempted_at timestamptz not null,
  unique(session_id,nonce_hash)
);

do $$ declare item record; begin for item in select schemaname,tablename from pg_tables where schemaname in('fulfillment','verification') loop execute format('alter table %I.%I enable row level security',item.schemaname,item.tablename); end loop; end $$;
commit;
