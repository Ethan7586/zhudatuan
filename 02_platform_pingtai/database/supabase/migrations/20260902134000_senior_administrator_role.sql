begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:senior-administrator-role:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
    where version='20260902133000'
      and checksum='0773015646b923fcf9e66a68c444fc164f6fadfb49d48f19344d59d638d66c4a')
    or exists(select 1 from runtime.schemaversion where version>'20260902133000') then
    raise exception 'SENIOR_ADMINISTRATOR_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

insert into access.role(id,scope_id,name,status,version)
select 'role-senior-administrator-v1:'||tenant.id,tenant.id,'高级管理员','active',1
from organization.organization tenant
where tenant.kind='tenant' and tenant.status='active'
on conflict(id) do update
set scope_id=excluded.scope_id,name=excluded.name,status='active',version=access.role.version+1;

delete from access.rolepermission mapping
using access.role role
where mapping.role_id=role.id
  and role.id='role-senior-administrator-v1:'||role.scope_id;

insert into access.rolepermission(role_id,permission_id,effect)
select distinct role.id,permission.id,'allow'
from access.role role
join capability.operation operation on operation.audience='operator'
join capability.capability capability on capability.id=operation.capability_id and capability.status='active'
join access.permission permission on permission.code=operation.permission_code and permission.status='active'
where role.id='role-senior-administrator-v1:'||role.scope_id
  and permission.code not in(
    'access.ownership.read','access.ownership.transfer','access.ownership.accept',
    'identity.registration.reset',
    'access.role.manage','access.scope.manage','capability.assignment.manage'
  )
on conflict do nothing;

create or replace function access.resolve_governance(
  p_membership_id text,
  p_actor_id text,
  p_scope_kind text,
  p_scope_id text
)
returns table(
  governance_level text,
  is_exact_owner boolean,
  actor_membership_id text,
  actor_principal_id text,
  organization_id text,
  owner_membership_id text,
  scope_kind text,
  scope_semantic_id text,
  scope_storage_id text,
  scope_organization_id text,
  resolved_at timestamptz
)
language sql stable security definer
set search_path=pg_catalog,pg_temp as $function$
  with decision_time as materialized(select statement_timestamp() resolved_at),
  actor_context as materialized(
    select membership.id membership_id,profile.principal_id,membership.organization_id,membership.client
    from decision_time
    join access.membership membership on membership.id=p_membership_id and membership.status='active'
    join member.profile profile on profile.id=membership.member_id
      and profile.principal_id=p_actor_id and profile.status='active'
    join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
  ), authoritative_owner as materialized(
    select owner.membership_id,profile.principal_id
    from decision_time
    join access.platformowner owner on owner.singleton=true and owner.state='active'
    join access.membership membership on membership.id=owner.membership_id and membership.status='active'
    join member.profile profile on profile.id=membership.member_id and profile.status='active'
    join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
    where exists(select 1 from access.membershiprole assignment
      where assignment.membership_id=owner.membership_id
        and assignment.role_id='role-platform-owner-v2'
        and assignment.effective_at<=decision_time.resolved_at
        and (assignment.expires_at is null or assignment.expires_at>decision_time.resolved_at))
  ), senior_administrator as materialized(
    select actor_context.membership_id
    from actor_context
    cross join decision_time
    where actor_context.client='operator' and exists(
      select 1 from access.membershiprole assignment
      join access.role role on role.id=assignment.role_id and role.status='active'
        and role.scope_id=actor_context.organization_id
      where assignment.membership_id=actor_context.membership_id
        and assignment.role_id='role-senior-administrator-v1:'||actor_context.organization_id
        and assignment.effective_at<=decision_time.resolved_at
        and (assignment.expires_at is null or assignment.expires_at>decision_time.resolved_at)
    )
  ), canonical_scope as materialized(
    select normalized.*
    from actor_context
    cross join lateral access.canonical_governance_scope(
      p_scope_kind,p_scope_id,actor_context.principal_id,actor_context.membership_id) normalized
  )
  select case
      when authoritative_owner.membership_id=actor_context.membership_id
        and authoritative_owner.principal_id=actor_context.principal_id then 'owner'
      when senior_administrator.membership_id=actor_context.membership_id then 'senior_administrator'
      when actor_context.client='operator' then 'administrator'
      else 'member'
    end governance_level,
    coalesce(authoritative_owner.membership_id=actor_context.membership_id
      and authoritative_owner.principal_id=actor_context.principal_id,false) is_exact_owner,
    actor_context.membership_id,actor_context.principal_id,actor_context.organization_id,
    authoritative_owner.membership_id,canonical_scope.scope_kind,canonical_scope.semantic_id,
    canonical_scope.storage_id,canonical_scope.organization_id,decision_time.resolved_at
  from decision_time
  cross join actor_context
  cross join canonical_scope
  left join authoritative_owner on true
  left join senior_administrator on true
$function$;

insert into runtime.schemaversion(version,checksum)
values('20260902134000','8c7592eea524151e9639f1b26eb63bc04725279e9ba2e54129ee2cfe4a8fe836');

do $assert$
begin
  if exists(select 1 from organization.organization tenant
    where tenant.kind='tenant' and tenant.status='active'
      and not exists(select 1 from access.role role
        where role.id='role-senior-administrator-v1:'||tenant.id
          and role.scope_id=tenant.id and role.name='高级管理员' and role.status='active')) then
    raise exception 'SENIOR_ADMINISTRATOR_ROLE_MISSING';
  end if;
  if exists(select 1 from access.rolepermission mapping
    join access.role role on role.id=mapping.role_id
    join access.permission permission on permission.id=mapping.permission_id
    where role.id='role-senior-administrator-v1:'||role.scope_id
      and (mapping.effect<>'allow' or permission.code in(
        'access.ownership.read','access.ownership.transfer','access.ownership.accept',
        'identity.registration.reset',
        'access.role.manage','access.scope.manage','capability.assignment.manage'
      ))) then
    raise exception 'SENIOR_ADMINISTRATOR_OWNER_ONLY_PERMISSION_INVALID';
  end if;
  if not exists(select 1 from runtime.schemaversion
    where version='20260902134000'
      and checksum='8c7592eea524151e9639f1b26eb63bc04725279e9ba2e54129ee2cfe4a8fe836') then
    raise exception 'SENIOR_ADMINISTRATOR_LEDGER_MISSING';
  end if;
end
$assert$;

commit;
