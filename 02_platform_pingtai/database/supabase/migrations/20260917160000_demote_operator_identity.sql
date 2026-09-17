begin;

-- L1 administers its own OP Membership, while the shared senior role is stored on its tenant.
-- Demotion changes only the selected target; the identity API needs no table-wide UPDATE grants.
create function access.demote_administrator(
  p_actor_membership_id text,p_target_membership_id text,p_role_id text,
  p_scope_kind text,p_scope_id text,p_expected_access_version bigint
) returns bigint
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare
  actor record;
  target record;
  role_scope text;
  changed_at timestamptz;
  changed_version bigint;
  removed_count bigint;
begin
  select membership.realm_id,governance.governance_level,governance.scope_organization_id
    into actor
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id
  cross join lateral access.resolve_authoritative_governance(
    membership.id,profile.principal_id,p_scope_kind,p_scope_id) governance
  where membership.id=p_actor_membership_id and membership.client='operator' and membership.status='active';
  if not found or actor.governance_level<>'owner' then
    raise exception 'OWNER_REQUIRED_FOR_SENIOR_ADMINISTRATOR';
  end if;

  select membership.id,membership.realm_id,membership.organization_id,membership.access_version,
      profile.principal_id,access.scope_object(membership.organization_id) membership_scope,
      exists(select 1 from access.platformowner owner where owner.singleton=true and owner.state='active'
        and owner.membership_id=membership.id) is_owner
    into target
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id
  where membership.id=p_target_membership_id and membership.client='operator' and membership.status='active'
  for update of membership;
  if not found then raise exception 'ADMINISTRATOR_NOT_ACTIVE'; end if;
  if actor.realm_id is null or target.realm_id is distinct from actor.realm_id
    or actor.scope_organization_id is distinct from coalesce(
      target.membership_scope->>'tenant',target.membership_scope->>'id') then
    raise exception 'MANAGEMENT_PERMISSION_REALM_MISMATCH';
  end if;
  if p_scope_kind='mall' and target.organization_id<>p_scope_id and not exists(
    select 1 from member.invite invitation where invitation.accepted_membership_id=target.id
      and invitation.storefront_organization_id=p_scope_id
  ) then raise exception 'ROLE_ASSIGNMENT_NOT_AVAILABLE'; end if;
  if target.is_owner then raise exception 'OWNER_ROLE_LEVEL_IMMUTABLE'; end if;
  if target.access_version<>p_expected_access_version then raise exception 'VERSION_CONFLICT'; end if;

  select role.scope_id into role_scope from access.role role
  where role.id=p_role_id and role.status='active'
    and role.id='role-senior-administrator-v1:'||role.scope_id
    and role.scope_id=actor.scope_organization_id
    and exists(select 1 from organization.unitclosure boundary
      where boundary.ancestor_id=role.scope_id and boundary.descendant_id=target.organization_id);
  if not found then raise exception 'ROLE_ASSIGNMENT_NOT_AVAILABLE'; end if;

  changed_at:=clock_timestamp();
  update access.membershiprole assignment set expires_at=changed_at
    where assignment.membership_id=target.id and assignment.role_id=p_role_id
      and coalesce(assignment.assigned_scope_id,role_scope)=role_scope
      and assignment.effective_at<=changed_at and (assignment.expires_at is null or assignment.expires_at>changed_at);
  get diagnostics removed_count=row_count;
  if removed_count=0 then raise exception 'SENIOR_ADMINISTRATOR_ASSIGNMENT_NOT_FOUND'; end if;

  update access.scopegrant scopegrant set expires_at=changed_at
    where scopegrant.membership_id=target.id and scopegrant.scope_id=role_scope
      and scopegrant.effect='allow' and scopegrant.effective_at<=changed_at
      and (scopegrant.expires_at is null or scopegrant.expires_at>changed_at)
      and not exists(select 1 from access.membershiprole assignment
        join access.role assigned_role on assigned_role.id=assignment.role_id
        where assignment.membership_id=target.id and assignment.effective_at<=changed_at
          and (assignment.expires_at is null or assignment.expires_at>changed_at)
          and coalesce(assignment.assigned_scope_id,assigned_role.scope_id)=role_scope);

  update access.membership membership
    set access_version=membership.access_version+1,
      operator_display_name=case
        when coalesce(membership.operator_display_name,profile.display_name) ~ '^(高级管理员|管理员) · .+$'
          or profile.display_name ~ '^L([0-9]|10|11)消费者[0-9]{4}$'
          then '管理员 · '||coalesce(nullif(right(profile.mobile_masked,4),''),right(profile.display_name,4))
        else coalesce(membership.operator_display_name,profile.display_name) end
    from member.profile profile where membership.id=target.id and membership.member_id=profile.id
      and membership.client='operator' and membership.status='active'
      and membership.access_version=p_expected_access_version
    returning membership.access_version into changed_version;
  if not found then raise exception 'VERSION_CONFLICT'; end if;
  return changed_version;
end
$function$;

revoke all on function access.demote_administrator(text,text,text,text,text,bigint) from public;
grant execute on function access.demote_administrator(text,text,text,text,text,bigint) to zhudatuanidentityapi;

insert into runtime.schemaversion(version,checksum)
values('20260917160000',encode(public.digest('demote-operator-identity:v1','sha256'),'hex'));

commit;
