create role shopapp nologin noinherit;
create role shopconsole nologin noinherit;
create role zhudatuanwebapi nologin noinherit;
create role zhudatuanpurchaseapi nologin noinherit;

create table identity.realmentry(
  host text primary key,
  realm_id text not null references identity.realm(id),
  kind text not null,
  status text not null,
  created_at timestamptz not null,
  unique(realm_id,host)
);

create table identity.realmtarget(
  realm_id text not null references identity.realm(id),
  surface text not null,
  target text not null,
  membership_client text not null,
  membership_organization_id text not null,
  application_slug text,
  return_origin text not null,
  created_at timestamptz not null,
  node_profile text not null,
  primary key(realm_id,target)
);

create table identity.principal(
  id text primary key,
  status text not null,
  credential_version bigint not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table identity.account(
  id text primary key,
  realm_id text not null references identity.realm(id),
  legacy_principal_id text references identity.principal(id),
  status text not null,
  credential_version bigint not null,
  assurance_level smallint not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(id,realm_id),
  unique(realm_id,legacy_principal_id)
);

create table identity.credential(
  id text primary key,
  principal_id text not null references identity.principal(id),
  provider text not null,
  subject_hash char(64) not null,
  secret_hash text,
  status text not null,
  created_at timestamptz not null,
  realm_id text not null,
  account_id text not null,
  foreign key(account_id,realm_id) references identity.account(id,realm_id),
  unique(realm_id,provider,subject_hash)
);

alter table access.membership
  add column access_version bigint not null default 1,
  add constraint sfl_multi_realm_membership_account
    foreign key(account_id,realm_id) references identity.account(id,realm_id);
alter table access.membership add constraint sfl_multi_realm_membership_identity unique(id,account_id,realm_id);

create table identity.assurance(
  id text primary key,
  principal_id text not null references identity.principal(id),
  session_id text,
  method text not null,
  level smallint not null,
  evidence_hash text not null,
  verified_at timestamptz not null,
  expires_at timestamptz,
  realm_id text not null,
  account_id text not null,
  foreign key(account_id,realm_id) references identity.account(id,realm_id)
);

create table identity.session(
  id text primary key,
  principal_id text not null references identity.principal(id),
  membership_id text not null,
  token_hash char(64) not null unique,
  credential_version bigint not null,
  access_version bigint not null,
  client text not null,
  assurance_level smallint not null,
  realm_id text not null,
  account_id text not null,
  auth_target text not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null,
  created_at timestamptz not null,
  revoked_at timestamptz,
  foreign key(membership_id,account_id,realm_id) references access.membership(id,account_id,realm_id),
  foreign key(account_id,realm_id) references identity.account(id,realm_id),
  foreign key(realm_id,auth_target) references identity.realmtarget(realm_id,target)
);

create function identity.resolve_session(text,text)
returns table(actor_id text,account_id text,realm_id text,session_id text,membership_id text,
  credential_version bigint,access_version bigint,target text,assurance_level smallint,assurance_verified_at timestamptz)
language sql stable as $$select null::text,null::text,null::text,null::text,null::text,
  null::bigint,null::bigint,null::text,null::smallint,null::timestamptz where false$$;

insert into organization.organization(id,kind,status) values('mall:mall-b','mall','active');
insert into identity.realm(
  id,node_id,status,created_at,updated_at,node_profile,mall_id,host_node_id,host_node_profile
) values(
  'realm:mall-b','node:mall-b:l0','active','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z',
  'operating_mall','mall:mall-b',null,null
);
insert into organization.node(
  id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at
) values(
  'node:mall-b:l0','line:mall-b:v1','sovereign','operating_mall','realm:mall-b','mall:mall-b','active',
  '2026-09-01T00:00:00Z','2026-09-01T00:00:00Z'
);
insert into organization.noderelation(
  line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,
  relation_version,effective_at
) values(
  'line:mall-b:v1','node:mall-b:l0',null,null,'L0','node:mall-b:l0',1,'2026-09-01T00:00:00Z'
);

insert into identity.realmentry(host,realm_id,kind,status,created_at) values
  ('api.mall-a.test','realm:l0','api','active','2026-09-01T00:00:00Z'),
  ('api.mall-b.test','realm:mall-b','api','active','2026-09-01T00:00:00Z');
insert into identity.realmtarget(
  realm_id,surface,target,membership_client,membership_organization_id,application_slug,
  return_origin,created_at,node_profile
) values
  ('realm:l0','consumer','storefront-a','storefront','mall-zhudatuan','mall-a','https://mall-a.test','2026-09-01T00:00:00Z','operating_mall'),
  ('realm:mall-b','consumer','storefront-b','storefront','mall:mall-b','mall-b','https://mall-b.test','2026-09-01T00:00:00Z','operating_mall');
