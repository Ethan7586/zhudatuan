create schema capability;

alter table organization.organization
  add column parent_id text references organization.organization(id),
  add column name text,
  add column timezone text,
  add column version bigint not null default 0,
  add column created_at timestamptz,
  add column updated_at timestamptz;
update organization.organization set name=id,timezone='Asia/Shanghai',created_at=clock_timestamp(),updated_at=clock_timestamp();
alter table organization.organization alter column name set not null;
alter table organization.organization alter column timezone set not null;
alter table organization.organization alter column created_at set not null;
alter table organization.organization alter column updated_at set not null;

create table organization.unitclosure(
  ancestor_id text not null references organization.organization(id),
  descendant_id text not null references organization.organization(id),
  depth integer not null,
  primary key(ancestor_id,descendant_id)
);
insert into organization.unitclosure(ancestor_id,descendant_id,depth)
select id,id,0 from organization.organization;

create table organization.change(
  id text primary key,
  organization_id text not null references organization.organization(id),
  kind text not null,
  before_value jsonb not null,
  after_value jsonb not null,
  actor_id text not null,
  occurred_at timestamptz not null
);

create table runtime.operation(
  id text primary key,
  owner text not null,
  method text not null,
  path text not null unique,
  contract_version text not null
);
create table runtime.event(
  type text not null,
  version integer not null,
  owner text not null,
  schema_ref text not null,
  primary key(type,version)
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
  available_at timestamptz not null,
  claimed_by text,
  claim_until timestamptz,
  attempts integer not null default 0,
  published_at timestamptz,
  failed_at timestamptz,
  error_code text
);

create table capability.capability(
  id text primary key,
  kind text not null,
  name text not null,
  version integer not null,
  status text not null
);
create table capability.operation(
  operation_id text primary key references runtime.operation(id),
  capability_id text not null unique references capability.capability(id),
  permission_code text,
  audience text not null
);
create table capability.entitlement(
  id text primary key,
  scope_id text not null,
  capability_id text not null references capability.capability(id),
  state text not null,
  quota bigint,
  effective_at timestamptz not null,
  expires_at timestamptz,
  version bigint not null,
  unique(scope_id,capability_id,effective_at)
);
insert into runtime.operation(id,owner,method,path,contract_version)
values('member.profile.read','member','GET','/api/v1/members/me','1.0.0');
insert into capability.capability(id,kind,name,version,status)
values('member.profile.read','operation','member.profile.read',1,'active');
insert into capability.operation(operation_id,capability_id,permission_code,audience)
values('member.profile.read','member.profile.read','member.profile.read','member');
insert into capability.entitlement(id,scope_id,capability_id,state,effective_at,version)
select 'profile-read:'||id,id,'member.profile.read','enabled','2026-09-01T00:00:00Z',0
from organization.organization;

do $rename$
declare shape_constraint text;
begin
  select constraint_row.conname into shape_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid='identity.realm'::regclass and constraint_row.contype='c'
    and pg_get_constraintdef(constraint_row.oid) like '%node_profile%operating_mall%host_node_id%';
  if shape_constraint is null then raise exception 'SFL_HOSTED_MALL_OPENING_REALM_SHAPE_MISSING'; end if;
  execute format('alter table identity.realm rename constraint %I to identity_realm_node_profile_shape',shape_constraint);
end
$rename$;

alter table identity.realmtarget add constraint identity_realmtarget_realm_profile
  foreign key(realm_id,node_profile) references identity.realm(id,node_profile);
alter table access.membership add constraint access_membership_realm_profile
  foreign key(realm_id,node_profile) references identity.realm(id,node_profile);
