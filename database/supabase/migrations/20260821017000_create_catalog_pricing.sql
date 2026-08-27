begin;

create table catalog.category(
  id text primary key,
  parent_id text references catalog.category(id),
  code text not null unique,
  name text not null,
  status text not null check(status in('active','disabled')),
  sort_order integer not null default 0
);
create table catalog.product(
  id text primary key,
  owner_partner_id text,
  brand_id text,
  category_id text not null references catalog.category(id),
  title text not null,
  product_type text not null check(product_type in('physical','virtual','service','voucher')),
  attributes jsonb not null default '{}'::jsonb check(jsonb_typeof(attributes)='object'),
  status text not null check(status in('draft','review','active','archived')),
  version bigint not null default 0 check(version>=0),
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create table catalog.sku(
  id text primary key,
  product_id text not null references catalog.product(id),
  code text not null unique,
  specifications jsonb not null check(jsonb_typeof(specifications)='object'),
  status text not null check(status in('draft','active','archived')),
  version bigint not null default 0
);
create table catalog.pool(
  id text primary key,
  scope_id text not null,
  kind text not null check(kind in('global','channel','private','markup')),
  name text not null,
  status text not null check(status in('draft','active','disabled')),
  version bigint not null default 0,
  unique(scope_id,name)
);
create table catalog.poolitem(
  pool_id text not null references catalog.pool(id) on delete cascade,
  sku_id text not null references catalog.sku(id),
  state text not null check(state in('included','excluded','unpublished')),
  source_version text not null,
  added_at timestamptz not null,
  primary key(pool_id,sku_id)
);
create table catalog.listing(
  id text primary key,
  scope_id text not null,
  pool_id text references catalog.pool(id),
  sku_id text not null references catalog.sku(id),
  title text not null,
  status text not null check(status in('draft','published','unpublished','retired')),
  effective_at timestamptz,
  expires_at timestamptz,
  version bigint not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,sku_id),
  check(expires_at is null or effective_at is null or expires_at>effective_at)
);
create table catalog.sourcelisting(
  id text primary key,
  provider text not null,
  external_id text not null,
  object_type text not null,
  sku_id text references catalog.sku(id),
  scope_id text not null,
  source_version text not null,
  source_payload jsonb not null,
  source_hash char(64) not null,
  status text not null check(status in('pending','mapped','rejected','retired')),
  observed_at timestamptz not null,
  unique(provider,object_type,external_id)
);
create table catalog.review(
  id text primary key,
  listing_id text not null references catalog.sourcelisting(id),
  state text not null check(state in('pending','approved','rejected')),
  reason text,
  reviewer_id text,
  decided_at timestamptz
);
create table catalog.suppliercategory(
  id text primary key,
  supplier_id text not null,
  source_code text,
  source_name text not null,
  category_id text not null references catalog.category(id),
  state text not null check(state in('draft','reviewed','disabled')),
  confidence numeric(4,3) not null check(confidence between 0 and 1),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(supplier_id,source_name)
);
create table catalog.classificationrule(
  id text primary key,
  taxonomy_version text not null,
  name text not null,
  source_field text not null,
  match_pattern text not null,
  category_id text not null references catalog.category(id),
  priority integer not null,
  status text not null check(status in('active','disabled')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create table catalog.poolbinding(
  mall_id text not null,
  pool_id text not null references catalog.pool(id),
  listing_kind text not null check(listing_kind in('selected','combined')),
  status text not null check(status in('active','disabled')),
  effective_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null,
  primary key(mall_id,pool_id)
);
create table catalog.availabilityzone(
  id text primary key,
  scope_id text not null,
  mall_id text,
  code text not null,
  name text not null,
  applies_to text not null check(applies_to in('visible','purchasable','both')),
  status text not null check(status in('draft','active','disabled')),
  effective_at timestamptz,
  expires_at timestamptz,
  attributes jsonb not null check(jsonb_typeof(attributes)='object'),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,code)
);
create table catalog.availabilitycity(
  zone_id text not null references catalog.availabilityzone(id),
  code text not null,
  name text not null,
  city_key text not null,
  primary key(zone_id,code),
  unique(zone_id,city_key)
);
create table catalog.availabilityitem(
  zone_id text not null references catalog.availabilityzone(id),
  resource_type text not null check(resource_type in('product','sku')),
  resource_id text not null,
  created_at timestamptz not null,
  primary key(zone_id,resource_type,resource_id)
);
create table catalog.importjob(
  id text primary key,
  scope_id text not null,
  object_ref text not null,
  sha256 char(64) not null,
  state text not null check(state in('uploaded','validating','ready','running','completed','failed','cancelled')),
  total_count integer not null default 0 check(total_count>=0),
  success_count integer not null default 0 check(success_count>=0),
  failure_count integer not null default 0 check(failure_count>=0),
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create table catalog.importerror(
  job_id text not null references catalog.importjob(id) on delete cascade,
  row_number integer not null check(row_number>0),
  reason_code text not null,
  field text,
  detail text not null,
  primary key(job_id,row_number,reason_code)
);

create table pricing.pricebook(
  id text primary key,
  scope_id text not null,
  currency char(3) not null,
  name text not null,
  status text not null check(status in('draft','active','retired')),
  version bigint not null default 0,
  unique(scope_id,name)
);
create table pricing.price(
  id text primary key,
  book_id text not null references pricing.pricebook(id),
  sku_id text not null,
  amount_minor bigint not null check(amount_minor>=0),
  compare_minor bigint check(compare_minor is null or compare_minor>=amount_minor),
  effective_at timestamptz not null,
  expires_at timestamptz,
  unique(book_id,sku_id,effective_at)
);
create table pricing.rule(
  id text primary key,
  scope_id text not null,
  priority integer not null,
  kind text not null,
  condition jsonb not null check(jsonb_typeof(condition)='object'),
  effect jsonb not null check(jsonb_typeof(effect)='object'),
  version integer not null check(version>0),
  status text not null check(status in('draft','published','retired')),
  effective_at timestamptz,
  unique(scope_id,id,version)
);
create table pricing.quote(
  id text primary key,
  member_id text not null,
  mall_id text not null,
  currency char(3) not null,
  subtotal_minor bigint not null check(subtotal_minor>=0),
  discount_minor bigint not null check(discount_minor>=0),
  payable_minor bigint not null check(payable_minor=subtotal_minor-discount_minor and payable_minor>=0),
  lines jsonb not null check(jsonb_typeof(lines)='array'),
  evidence_hash char(64) not null,
  expires_at timestamptz not null,
  created_at timestamptz not null
);

do $$ declare item record; begin for item in select schemaname,tablename from pg_tables where schemaname in('catalog','pricing') loop execute format('alter table %I.%I enable row level security',item.schemaname,item.tablename); end loop; end $$;
commit;
