begin;

create table organization.organization(
  id text primary key,
  kind text not null check(kind in('platform','distributor','tenant','enterprise','mall','department')),
  parent_id text references organization.organization(id),
  name text not null,
  timezone text not null,
  status text not null check(status in('draft','active','disabled')),
  version bigint not null default 0 check(version>=0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check(parent_id is not null or kind='platform')
);
create table organization.unitclosure(
  ancestor_id text not null references organization.organization(id) on delete cascade,
  descendant_id text not null references organization.organization(id) on delete cascade,
  depth integer not null check(depth>=0),
  primary key(ancestor_id,descendant_id),
  check((depth=0)=(ancestor_id=descendant_id))
);
create table organization.change(
  id text primary key,
  organization_id text not null references organization.organization(id),
  kind text not null,
  before_value jsonb not null,
  after_value jsonb not null,
  actor_id text not null,
  occurred_at timestamptz not null
);
create table organization.sourcebinding(
  source_type text not null,
  source_id text not null,
  organization_id text not null references organization.organization(id),
  source_code text not null,
  primary key(source_type,source_id),
  unique(organization_id,source_type)
);
create table organization.assignment(
  parent_id text not null references organization.organization(id),
  child_id text not null references organization.organization(id),
  kind text not null,
  status text not null check(status in('draft','active','expired','terminated')),
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  effective_at timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key(parent_id,child_id,kind,effective_at)
);

create table partner.partner(
  id text primary key,
  scope_id text not null,
  kind text not null check(kind in('supplier','store','brand')),
  name text not null,
  status text not null check(status in('pending','active','suspended','terminated')),
  version bigint not null default 0 check(version>=0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(scope_id,kind,name)
);
create table partner.store(
  id text primary key references partner.partner(id),
  mall_id text,
  region_code text not null,
  address_ciphertext text,
  address_token char(64),
  address_key_version text,
  service_radius_meters integer check(service_radius_meters is null or service_radius_meters>0),
  check((address_ciphertext is null)=(address_token is null)),
  check((address_ciphertext is null)=(address_key_version is null))
);
create table partner.brand(
  id text primary key references partner.partner(id),
  owner_partner_id text references partner.partner(id),
  code text not null unique
);
create table partner.agreement(
  id text primary key,
  partner_id text not null references partner.partner(id),
  mall_id text not null,
  contract_ref text not null,
  contract_hash char(64) not null,
  capabilities jsonb not null check(jsonb_typeof(capabilities)='array'),
  effective_at timestamptz not null,
  expires_at timestamptz,
  status text not null check(status in('draft','active','expired','terminated')),
  unique(partner_id,mall_id,effective_at)
);
create table partner.qualificationdocument(
  id text primary key,
  partner_id text not null references partner.partner(id),
  kind text not null,
  object_ref text not null,
  sha256 char(64) not null,
  expires_at timestamptz,
  verified_at timestamptz,
  status text not null check(status in('pending','valid','rejected','expired'))
);
create table partner.relationship(
  id text primary key,
  scope_id text not null,
  left_partner_id text not null references partner.partner(id),
  right_partner_id text not null references partner.partner(id),
  kind text not null,
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  effective_at timestamptz,
  expires_at timestamptz,
  status text not null check(status in('draft','active','expired','terminated')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(left_partner_id,right_partner_id,kind)
);
create table partner.servicebinding(
  store_id text not null references partner.store(id),
  organization_id text not null references organization.organization(id),
  service text not null check(service in('fulfillment','verification','service')),
  status text not null check(status in('active','disabled')),
  effective_at timestamptz,
  expires_at timestamptz,
  primary key(store_id,organization_id,service)
);

do $$ declare item record; begin
  for item in select schemaname,tablename from pg_tables where schemaname in('organization','partner') loop execute format('alter table %I.%I enable row level security',item.schemaname,item.tablename); end loop;
end $$;
commit;
