create extension if not exists pgcrypto;
create role shopapp nologin noinherit;
create role shopconsole nologin noinherit;
create role zhudatuanidentityapi nologin noinherit;
create schema runtime;
create schema identity;
create schema organization;
create schema access;
create schema capability;
grant usage on schema access to shopapp,shopconsole,zhudatuanidentityapi;

create table runtime.schemaversion(version text primary key,checksum char(64) not null);
create table runtime.operation(
  id text primary key,owner text not null,method text not null,path text not null,contract_version text not null,unique(method,path)
);
create table runtime.outbox(
  id text primary key,event_type text not null,event_version integer not null,aggregate_type text not null,
  aggregate_id text not null,scope_id text not null,payload jsonb not null,trace_id text not null,
  occurred_at timestamptz not null,available_at timestamptz not null,claimed_by text,claim_until timestamptz,
  attempts integer not null default 0,published_at timestamptz,failed_at timestamptz,error_code text
);

create table identity.realm(id text primary key,node_id text not null unique,status text not null);
create table identity.principal(id text primary key,status text not null);
create table identity.account(
  id text primary key,realm_id text not null references identity.realm(id),legacy_principal_id text not null references identity.principal(id),
  status text not null,credential_version bigint not null default 1,unique(id,realm_id),unique(realm_id,legacy_principal_id)
);

create table organization.node(
  id text primary key,line_id text not null,sovereignty_tier text not null,node_profile text not null,
  realm_id text not null unique references identity.realm(id),mall_id text,status text not null,
  created_at timestamptz not null,updated_at timestamptz not null,unique(id,line_id)
);
create table organization.noderelation(
  line_id text not null,node_id text not null,parent_node_id text,original_parent_node_id text,signed_level text not null,
  host_sovereign_node_id text not null,relation_version bigint not null,effective_at timestamptz not null,superseded_at timestamptz,
  primary key(line_id,node_id,relation_version)
);
create table organization.nodeclosure(
  closure_id bigint generated always as identity primary key,line_id text not null,descendant_node_id text not null,
  ancestor_node_id text not null,depth integer not null,descendant_relation_version bigint not null,
  effective_at timestamptz not null,superseded_at timestamptz
);

create table access.permission(id text primary key,code text not null unique,risk text not null,status text not null);
create table capability.capability(
  id text primary key,kind text not null,name text not null,version integer not null,status text not null,unique(kind,name,version)
);
create table capability.operation(
  operation_id text primary key references runtime.operation(id),capability_id text not null unique references capability.capability(id),
  permission_code text,audience text not null
);
create table capability.entitlement(
  id text primary key,scope_id text not null,capability_id text not null references capability.capability(id),state text not null,
  quota bigint,effective_at timestamptz not null,expires_at timestamptz,version bigint not null
);
create table access.role(id text primary key,scope_id text not null,name text not null,status text not null,version bigint not null);
create table access.rolepermission(
  role_id text not null references access.role(id),permission_id text not null references access.permission(id),effect text not null,
  primary key(role_id,permission_id,effect)
);
create table access.membership(
  id text primary key,member_id text not null,organization_id text not null,client text not null,status text not null,
  access_version bigint not null,joined_at timestamptz,realm_id text not null,account_id text not null,
  foreign key(account_id,realm_id) references identity.account(id,realm_id),unique(id,account_id,realm_id)
);
create table access.membershiprole(
  membership_id text not null references access.membership(id),role_id text not null references access.role(id),
  effective_at timestamptz not null,expires_at timestamptz,delegated_by text,assigned_scope_kind text,
  assigned_scope_id text,assigned_scope_path text,scope_source text,
  primary key(membership_id,role_id,effective_at)
);

insert into runtime.schemaversion(version,checksum)
values('20260912050000','1cd685bc700d26773ffd1c5937c908cb5bff4d61d7c2c07a185da16dc7d5f899');

insert into identity.principal(id,status) values
  ('principal:owner','active'),('principal:first','active'),('principal:second','active'),
  ('principal:both','active'),('principal:dual','active'),('principal:concurrent','active'),
  ('principal:race','active'),('principal:fault','active'),('principal:member-only','active');
insert into identity.realm(id,node_id,status) values
  ('realm:a-l0','node:a:l0','active'),('realm:a-l3','node:a:l3','active'),('realm:a-l5','node:a:l5','active'),
  ('realm:a-l6','node:a:l6','active'),('realm:a-l8','node:a:l8','active'),('realm:a-l11','node:a:l11','active'),
  ('realm:a-supplier','node:a:l-1','active'),('realm:b-l3','node:b:l3','active');
insert into identity.account(id,realm_id,legacy_principal_id,status) values
  ('account:owner','realm:a-l0','principal:owner','active'),('account:first','realm:a-l0','principal:first','active'),
  ('account:second','realm:a-l0','principal:second','active'),('account:both','realm:a-l0','principal:both','active'),
  ('account:dual-admin','realm:a-l0','principal:dual','active'),('account:dual-member','realm:a-l6','principal:dual','active'),
  ('account:concurrent','realm:a-l0','principal:concurrent','active'),('account:race','realm:a-l0','principal:race','active'),
  ('account:fault','realm:a-l0','principal:fault','active'),('account:member-only','realm:a-l3','principal:member-only','active');

insert into organization.node(id,line_id,sovereignty_tier,node_profile,realm_id,mall_id,status,created_at,updated_at) values
  ('node:a:l0','line:a','sovereign','operating_mall','realm:a-l0','mall:a','active',clock_timestamp(),clock_timestamp()),
  ('node:a:l3','line:a','hosted','operating_mall','realm:a-l3','mall:a-l3','active',clock_timestamp(),clock_timestamp()),
  ('node:a:l5','line:a','hosted','consumer','realm:a-l5',null,'active',clock_timestamp(),clock_timestamp()),
  ('node:a:l6','line:a','hosted','consumer','realm:a-l6',null,'active',clock_timestamp(),clock_timestamp()),
  ('node:a:l8','line:a','hosted','operating_mall','realm:a-l8','mall:a-l8','active',clock_timestamp(),clock_timestamp()),
  ('node:a:l11','line:a','hosted','consumer','realm:a-l11',null,'active',clock_timestamp(),clock_timestamp()),
  ('node:a:l-1','line:a','hosted','operating_mall','realm:a-supplier','mall:supplier','active',clock_timestamp(),clock_timestamp()),
  ('node:b:l3','line:b','sovereign','operating_mall','realm:b-l3','mall:b','active',clock_timestamp(),clock_timestamp());
insert into organization.noderelation(
  line_id,node_id,parent_node_id,original_parent_node_id,signed_level,host_sovereign_node_id,relation_version,effective_at
) values
  ('line:a','node:a:l0',null,null,'L0','node:a:l0',1,clock_timestamp()),
  ('line:a','node:a:l3','node:a:l0','node:a:l0','L3','node:a:l0',1,clock_timestamp()),
  ('line:a','node:a:l5','node:a:l3','node:a:l3','L5','node:a:l0',1,clock_timestamp()),
  ('line:a','node:a:l6','node:a:l5','node:a:l5','L6','node:a:l0',1,clock_timestamp()),
  ('line:a','node:a:l8','node:a:l6','node:a:l6','L8','node:a:l0',1,clock_timestamp()),
  ('line:a','node:a:l11','node:a:l8','node:a:l8','L11','node:a:l0',1,clock_timestamp()),
  ('line:a','node:a:l-1','node:a:l0','node:a:l0','L-1','node:a:l0',1,clock_timestamp()),
  ('line:b','node:b:l3',null,null,'L3','node:b:l3',1,clock_timestamp());
insert into organization.nodeclosure(line_id,descendant_node_id,ancestor_node_id,depth,descendant_relation_version,effective_at)
select 'line:a',node_id,'node:a:l0',depth,1,clock_timestamp() from (values
  ('node:a:l0',0),('node:a:l3',1),('node:a:l5',2),('node:a:l6',3),('node:a:l8',4),('node:a:l11',5),('node:a:l-1',1)
) nodes(node_id,depth);
insert into organization.nodeclosure(line_id,descendant_node_id,ancestor_node_id,depth,descendant_relation_version,effective_at)
select line_id,id,id,0,1,clock_timestamp() from organization.node where id<>'node:a:l0';

insert into access.permission(id,code,risk,status) values
  ('permission:access-scope-manage','access.scope.manage','critical','active'),
  ('permission:member-read','member.read','elevated','active'),
  ('permission:member-manage','member.manage','high','active');
insert into access.role(id,scope_id,name,status,version) values
  ('role-platform-owner-v2','realm:a-l0','Owner','active',1),
  ('role:segment-administrator','realm:a-l0','管理员','active',1),
  ('role:self','self','本人','active',1);
insert into access.rolepermission(role_id,permission_id,effect) values
  ('role-platform-owner-v2','permission:access-scope-manage','allow'),
  ('role-platform-owner-v2','permission:member-read','allow'),
  ('role-platform-owner-v2','permission:member-manage','allow'),
  ('role:segment-administrator','permission:member-read','allow'),
  ('role:segment-administrator','permission:member-manage','allow');

insert into access.membership(
  id,member_id,organization_id,client,status,access_version,joined_at,realm_id,account_id
) values
  ('membership:owner','member:owner','realm:a-l0','operator','active',1,clock_timestamp(),'realm:a-l0','account:owner'),
  ('membership:admin-first','member:first','realm:a-l0','operator','active',1,clock_timestamp(),'realm:a-l0','account:first'),
  ('membership:admin-second','member:second','realm:a-l0','operator','active',1,clock_timestamp(),'realm:a-l0','account:second'),
  ('membership:admin-both','member:both','realm:a-l0','operator','active',1,clock_timestamp(),'realm:a-l0','account:both'),
  ('membership:admin-dual','member:dual','realm:a-l0','operator','active',1,clock_timestamp(),'realm:a-l0','account:dual-admin'),
  ('membership:member-dual','member:dual','node:a:l6','storefront','active',1,clock_timestamp(),'realm:a-l6','account:dual-member'),
  ('membership:admin-concurrent','member:concurrent','realm:a-l0','operator','active',1,clock_timestamp(),'realm:a-l0','account:concurrent'),
  ('membership:admin-race','member:race','realm:a-l0','operator','active',1,clock_timestamp(),'realm:a-l0','account:race'),
  ('membership:admin-fault','member:fault','realm:a-l0','operator','active',1,clock_timestamp(),'realm:a-l0','account:fault'),
  ('membership:member-only','member:member-only','node:a:l3','storefront','active',1,clock_timestamp(),'realm:a-l3','account:member-only');
insert into access.membershiprole(membership_id,role_id,effective_at)
values('membership:owner','role-platform-owner-v2',clock_timestamp());
