create extension if not exists pgcrypto;
create schema runtime;
create schema identity;
create schema organization;
create schema access;
create schema capability;

create role shopmigration nologin noinherit;
create role shopapp nologin noinherit;
create role zhudatuanidentityapi nologin noinherit;
create role shopconsole nologin noinherit;
create role zhudatuanwebapi nologin noinherit;
create role zhudatuanpurchaseapi nologin noinherit;
create role zhudatuanprovisioningapi nologin noinherit;

create table runtime.schemaversion(version text primary key,checksum text not null);
insert into runtime.schemaversion(version,checksum)
values('20260912230000','00957fef847764497bcc033057d4feceb919c7a90a6ec984daf6e40f2694b096');

create table organization.organization(id text primary key,status text not null);
create table identity.realm(id text primary key,status text not null);
create table identity.realmentry(host text primary key,realm_id text not null,status text not null);
create table identity.realmtarget(
  realm_id text not null,target text not null,surface text not null,membership_client text not null,
  membership_organization_id text not null,primary key(realm_id,target)
);
create table identity.principal(id text primary key,status text not null);
create table identity.account(
  id text primary key,realm_id text not null,legacy_principal_id text not null,status text not null,
  credential_version bigint not null,unique(id,realm_id)
);
create table organization.node(
  id text primary key,line_id text not null,realm_id text not null,node_profile text not null,
  mall_id text,status text not null
);
create table organization.noderelation(
  line_id text not null,node_id text not null,parent_node_id text,signed_level text not null,
  host_sovereign_node_id text not null,relation_version integer not null,effective_at timestamptz not null,
  superseded_at timestamptz,primary key(line_id,node_id,relation_version)
);
create table access.membership(
  id text primary key,account_id text not null,realm_id text not null,organization_id text not null,
  client text not null,status text not null,access_version bigint not null
);
create table identity.session(
  id text primary key,principal_id text not null,account_id text not null,realm_id text not null,
  membership_id text not null,token_hash text not null,credential_version bigint not null,
  access_version bigint not null,client text not null,auth_target text not null,
  assurance_level smallint not null,expires_at timestamptz not null,revoked_at timestamptz
);
create table identity.assurance(
  id text primary key,account_id text not null,realm_id text not null,method text not null,
  level smallint not null,evidence_hash text not null,verified_at timestamptz not null,expires_at timestamptz
);
create table access.permission(id text primary key,code text not null,status text not null);
create table access.role(id text primary key,scope_id text not null,status text not null);
create table access.rolepermission(role_id text not null,permission_id text not null,effect text not null);
create table access.membershiprole(
  membership_id text not null,role_id text not null,effective_at timestamptz not null,expires_at timestamptz
);
create table access.scopegrant(
  membership_id text not null,scope_id text not null,scope_kind text not null,effect text not null,
  effective_at timestamptz not null,expires_at timestamptz,access_version bigint not null
);
create table capability.operation(operation_id text primary key,permission_code text not null);

create function identity.resolve_active_membership_context(
  p_entry_realm_id text,p_account_id text,p_membership_id text
)
returns table(
  entry_realm_id text,current_realm_id text,account_id text,active_membership_id text,
  line_id text,node_id text,parent_node_id text,signed_level text,sovereignty_tier text,
  node_profile text,mall_id text,host_sovereign_node_id text,relation_version integer,
  effective_at text,access_version bigint,status text
)
language sql stable as $function$
  select p_entry_realm_id,membership.realm_id,membership.account_id,membership.id,node.line_id,node.id,
    relation.parent_node_id,relation.signed_level,'sovereign',node.node_profile,node.mall_id,
    relation.host_sovereign_node_id,relation.relation_version,
    to_char(relation.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    membership.access_version,node.status
  from access.membership membership
  join identity.account account on account.id=membership.account_id and account.realm_id=membership.realm_id
  join organization.node node on node.realm_id=membership.realm_id and node.status='active'
  join organization.noderelation relation on relation.line_id=node.line_id and relation.node_id=node.id
    and relation.superseded_at is null
  where p_entry_realm_id=membership.realm_id and membership.account_id=p_account_id
    and membership.id=p_membership_id and membership.status='active' and account.status='active'
$function$;

create function identity.resolve_session(text,text)
returns table(
  actor_id text,account_id text,realm_id text,session_id text,membership_id text,
  credential_version bigint,access_version bigint,target text,assurance_level smallint,
  assurance_verified_at timestamptz,entry_realm_id text,line_id text,node_id text,
  parent_node_id text,signed_level text,node_profile text,mall_id text,
  host_sovereign_node_id text,relation_version integer
)
language sql stable as $function$
  select null::text,null::text,null::text,null::text,null::text,null::bigint,null::bigint,
    null::text,null::smallint,null::timestamptz,null::text,null::text,null::text,null::text,
    null::text,null::text,null::text,null::text,null::integer where false
$function$;

create function access.resolve_membership(p_membership_id text)
returns table(id text,active boolean,access_version bigint,denies text[],grants jsonb)
language sql stable as $function$
  select membership.id,membership.status='active',membership.access_version,array[]::text[],
    coalesce(jsonb_agg(distinct jsonb_build_object(
      'scope',jsonb_build_object('kind',scope.scope_kind,'id',scope.scope_id,'tenant',membership.organization_id,'path','[]'::jsonb),
      'permissions',jsonb_build_array(permission.code),
      'effective',scope.effective_at,'expires',scope.expires_at
    )) filter(where permission.code is not null),'[]'::jsonb)
  from access.membership membership
  left join access.membershiprole assignment on assignment.membership_id=membership.id
    and assignment.effective_at<=clock_timestamp()
    and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
  left join access.role role on role.id=assignment.role_id and role.status='active'
    and role.scope_id=membership.organization_id
  left join access.rolepermission mapping on mapping.role_id=role.id and mapping.effect='allow'
  left join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
  left join access.scopegrant scope on scope.membership_id=membership.id and scope.effect='allow'
    and scope.access_version<=membership.access_version and scope.effective_at<=clock_timestamp()
    and (scope.expires_at is null or scope.expires_at>clock_timestamp())
  where membership.id=p_membership_id
  group by membership.id
$function$;

create function access.membership_version(p_membership_id text)
returns bigint language sql stable as $function$
  select membership.access_version from access.membership membership
  where membership.id=p_membership_id and membership.status='active'
$function$;

create function access.resolve_scope(
  p_membership_id text,p_operation text,p_resource text,p_scope_hint text
)
returns table(scope jsonb) language sql stable as $function$
  select jsonb_build_object('kind',grantrow.scope_kind,'id',grantrow.scope_id,
    'tenant',membership.organization_id,'path','[]'::jsonb)
  from access.membership membership
  join access.scopegrant grantrow on grantrow.membership_id=membership.id and grantrow.effect='allow'
    and grantrow.effective_at<=clock_timestamp()
    and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp())
  join access.membershiprole assignment on assignment.membership_id=membership.id
    and assignment.effective_at<=clock_timestamp()
    and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
  join access.role role on role.id=assignment.role_id and role.scope_id=membership.organization_id
    and role.status='active'
  join access.rolepermission mapping on mapping.role_id=role.id and mapping.effect='allow'
  join access.permission permission on permission.id=mapping.permission_id and permission.code=p_operation
    and permission.status='active'
  where membership.id=p_membership_id and membership.status='active'
    and (p_scope_hint is null or p_scope_hint=grantrow.scope_id)
  order by grantrow.scope_id limit 1
$function$;

create function capability.membership_operations(p_membership_id text)
returns table(operation_id text) language sql stable as $function$
  select distinct operation.operation_id
  from capability.operation operation
  join access.permission permission on permission.code=operation.permission_code and permission.status='active'
  join access.rolepermission mapping on mapping.permission_id=permission.id and mapping.effect='allow'
  join access.membershiprole assignment on assignment.role_id=mapping.role_id
    and assignment.membership_id=p_membership_id and assignment.effective_at<=clock_timestamp()
    and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
  join access.membership membership on membership.id=assignment.membership_id and membership.status='active'
  join access.role role on role.id=assignment.role_id and role.scope_id=membership.organization_id
    and role.status='active'
$function$;

insert into organization.organization(id,status) values
  ('tenant:a','active'),('mall:a','active'),('mall:b','active'),('tenant:wrong','active');
insert into identity.realm(id,status) values('realm:a','active'),('realm:b','active');
insert into identity.realmentry(host,realm_id,status) values
  ('api.a.test','realm:a','active'),('api.b.test','realm:b','active');
insert into identity.realmtarget(realm_id,target,surface,membership_client,membership_organization_id) values
  ('realm:a','console-a','operator','operator','tenant:a'),
  ('realm:a','storefront-a','consumer','storefront','mall:a'),
  ('realm:a','console-wrong','operator','operator','tenant:wrong'),
  ('realm:b','storefront-b','consumer','storefront','mall:b');
insert into identity.principal(id,status) values('principal:shared','active');
insert into identity.account(id,realm_id,legacy_principal_id,status,credential_version) values
  ('account:a','realm:a','principal:shared','active',1),
  ('account:b','realm:b','principal:shared','active',1);
insert into organization.node(id,line_id,realm_id,node_profile,mall_id,status) values
  ('node:a','line:a','realm:a','operating_mall','mall:a','active'),
  ('node:b','line:b','realm:b','operating_mall','mall:b','active');
insert into organization.noderelation(
  line_id,node_id,parent_node_id,signed_level,host_sovereign_node_id,relation_version,effective_at
) values
  ('line:a','node:a',null,'L0','node:a',1,'2026-09-01T00:00:00Z'),
  ('line:b','node:b',null,'L0','node:b',1,'2026-09-01T00:00:00Z');
insert into access.membership(id,account_id,realm_id,organization_id,client,status,access_version) values
  ('membership:operator','account:a','realm:a','tenant:a','operator','active',1),
  ('membership:storefront','account:a','realm:a','mall:a','storefront','active',1),
  ('membership:realm-b','account:b','realm:b','mall:b','storefront','active',1),
  ('membership:inactive','account:a','realm:a','mall:a','storefront','suspended',1);
insert into access.permission(id,code,status) values
  ('permission:admin','admin.members.read','active'),
  ('permission:catalog','catalog.listings.read','active'),
  ('permission:realm-b','realm.assets.read','active');
insert into access.role(id,scope_id,status) values
  ('role:operator','tenant:a','active'),('role:storefront','mall:a','active'),
  ('role:realm-b','mall:b','active'),('role:foreign','tenant:wrong','active');
insert into access.rolepermission(role_id,permission_id,effect) values
  ('role:operator','permission:admin','allow'),('role:storefront','permission:catalog','allow'),
  ('role:realm-b','permission:realm-b','allow'),('role:foreign','permission:admin','allow');
insert into access.membershiprole(membership_id,role_id,effective_at) values
  ('membership:operator','role:operator','2026-09-01T00:00:00Z'),
  ('membership:storefront','role:storefront','2026-09-01T00:00:00Z'),
  ('membership:storefront','role:foreign','2026-09-01T00:00:00Z'),
  ('membership:realm-b','role:realm-b','2026-09-01T00:00:00Z');
insert into access.scopegrant(membership_id,scope_id,scope_kind,effect,effective_at,access_version) values
  ('membership:operator','tenant:a','tenant','allow','2026-09-01T00:00:00Z',1),
  ('membership:storefront','mall:a','mall','allow','2026-09-01T00:00:00Z',1),
  ('membership:realm-b','mall:b','mall','allow','2026-09-01T00:00:00Z',1);
insert into capability.operation(operation_id,permission_code) values
  ('admin.members.read','admin.members.read'),('catalog.listings.read','catalog.listings.read'),
  ('realm.assets.read','realm.assets.read');
insert into identity.session(
  id,principal_id,account_id,realm_id,membership_id,token_hash,credential_version,
  access_version,client,auth_target,assurance_level,expires_at
) values
  ('session:operator','principal:shared','account:a','realm:a','membership:operator',
    encode(public.digest('token-operator','sha256'),'hex'),1,1,'operator','console-a',1,clock_timestamp()+interval '1 hour'),
  ('session:storefront','principal:shared','account:a','realm:a','membership:storefront',
    encode(public.digest('token-storefront','sha256'),'hex'),1,1,'storefront','storefront-a',1,clock_timestamp()+interval '1 hour'),
  ('session:realm-b','principal:shared','account:b','realm:b','membership:realm-b',
    encode(public.digest('token-realm-b','sha256'),'hex'),1,1,'storefront','storefront-b',1,clock_timestamp()+interval '1 hour'),
  ('session:inactive','principal:shared','account:a','realm:a','membership:inactive',
    encode(public.digest('token-inactive','sha256'),'hex'),1,1,'storefront','storefront-a',1,clock_timestamp()+interval '1 hour'),
  ('session:organization-mismatch','principal:shared','account:a','realm:a','membership:operator',
    encode(public.digest('token-organization-mismatch','sha256'),'hex'),1,1,'operator','console-wrong',1,clock_timestamp()+interval '1 hour');

grant usage on schema identity,organization,access,capability,public to shopmigration;
grant select on all tables in schema identity,organization,access,capability to shopmigration;
grant execute on function identity.resolve_active_membership_context(text,text,text),public.digest(text,text)
  to shopmigration;
