begin;

create table cart.cart(
  id text primary key,
  member_id text not null,
  mall_id text not null,
  application_id text not null,
  state text not null check(state in('active','converted','abandoned')),
  version bigint not null default 0,
  updated_at timestamptz not null
);
create unique index cart_one_active on cart.cart(member_id,mall_id,application_id) where state='active';
create table cart.item(
  cart_id text not null references cart.cart(id) on delete cascade,
  listing_id text not null,
  sku_id text not null,
  quantity bigint not null check(quantity>0),
  listing_version text not null,
  version bigint not null default 0,
  primary key(cart_id,listing_id)
);

create table checkout.address(
  id text primary key,
  member_id text not null,
  recipient_ciphertext text not null,
  mobile_ciphertext text not null,
  address_ciphertext text not null,
  region_token char(64) not null,
  address_token char(64) not null,
  status text not null check(status in('active','deleted')),
  version bigint not null default 0
);
create table checkout.session(
  id text primary key,
  cart_id text not null,
  member_id text not null,
  mall_id text not null,
  application_id text not null,
  quote_id text not null,
  quote_hash char(64) not null,
  address_id text,
  state text not null check(state in('draft','quoted','confirmed','expired','cancelled')),
  expires_at timestamptz not null,
  created_at timestamptz not null,
  version bigint not null default 0
);
create table checkout.evidence(
  checkout_id text not null references checkout.session(id) on delete cascade,
  kind text not null check(kind in('qualification','price','inventory','delivery')),
  reference_id text not null,
  version text not null,
  payload_hash char(64) not null,
  expires_at timestamptz,
  primary key(checkout_id,kind,reference_id)
);

create table ordering.orderrecord(
  id text primary key,
  order_number text not null unique,
  scope_id text not null,
  member_id text not null,
  mall_id text not null,
  checkout_id text not null unique,
  currency char(3) not null,
  total_minor bigint not null check(total_minor>=0),
  payment_state text not null check(payment_state in('unpaid','authorizing','paid','partially_refunded','refunded','failed')),
  fulfillment_state text not null check(fulfillment_state in('unallocated','allocated','processing','shipped','delivered','cancelled','returned')),
  aftersale_state text not null check(aftersale_state in('none','requested','processing','resolved','rejected')),
  lifecycle_state text not null check(lifecycle_state in('created','active','completed','cancelled','closed')),
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null default 0
);
create table ordering.line(
  id text primary key,
  order_id text not null references ordering.orderrecord(id),
  sku_id text not null,
  listing_id text not null,
  title_snapshot text not null,
  quantity bigint not null check(quantity>0),
  unit_minor bigint not null check(unit_minor>=0),
  total_minor bigint not null check(total_minor=unit_minor*quantity),
  qualification_evidence_id text,
  provider text
);
create table ordering.suborder(
  id text primary key,
  order_id text not null references ordering.orderrecord(id),
  partner_id text,
  provider text,
  state text not null,
  version bigint not null default 0
);
create table ordering.aftersale(
  id text primary key,
  order_id text not null references ordering.orderrecord(id),
  line_id text references ordering.line(id),
  kind text not null check(kind in('cancel','return','refund','exchange','claim')),
  state text not null check(state in('requested','approved','rejected','processing','completed','cancelled')),
  quantity bigint check(quantity is null or quantity>0),
  amount_minor bigint check(amount_minor is null or amount_minor>=0),
  reason text not null,
  requested_by text,
  requested_membership_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  version bigint not null default 0
);
create table ordering.reviewaction(
  id text primary key,
  aftersale_id text not null references ordering.aftersale(id),
  previous_state text not null,
  next_state text not null,
  reason text not null,
  evidence text,
  actor_id text not null,
  membership_id text not null,
  grant_evidence jsonb not null check(jsonb_typeof(grant_evidence)='object'),
  trace_id text not null,
  occurred_at timestamptz not null,
  unique(aftersale_id,next_state)
);
create table ordering.stateevent(
  order_id text not null references ordering.orderrecord(id),
  sequence bigint not null,
  dimension text not null,
  previous_state text,
  next_state text not null,
  reason text not null,
  actor_id text not null,
  occurred_at timestamptz not null,
  primary key(order_id,sequence)
);

do $$ declare item record; begin for item in select schemaname,tablename from pg_tables where schemaname in('cart','checkout','ordering') loop execute format('alter table %I.%I enable row level security',item.schemaname,item.tablename); end loop; end $$;
commit;
