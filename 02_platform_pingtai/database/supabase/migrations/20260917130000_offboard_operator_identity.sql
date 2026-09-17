begin;

-- The identity API can read OP assignments but cannot lock or update their tables.
-- Keep the existing offboard checks and seven writes together without granting
-- that runtime role general UPDATE access to Membership or administrator tables.
create function access.offboard_administrator(
  p_actor_membership_id text,p_target_membership_id text,
  p_scope_kind text,p_scope_id text,p_expected_access_version bigint
) returns bigint
language plpgsql security definer
set search_path=pg_catalog,pg_temp as $function$
declare
  actor record;
  target record;
  target_governance text;
  changed_at timestamptz;
  changed_version bigint;
begin
  select membership.realm_id,governance.governance_level,governance.scope_organization_id
    into actor
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id
  cross join lateral access.resolve_authoritative_governance(
    membership.id,profile.principal_id,p_scope_kind,p_scope_id) governance
  where membership.id=p_actor_membership_id and membership.client='operator' and membership.status='active';
  if not found or actor.governance_level not in('owner','senior_administrator') then
    raise exception 'OWNER_REQUIRED_FOR_ADMINISTRATOR_OFFBOARDING';
  end if;

  select membership.id,membership.realm_id,membership.organization_id,membership.access_version,
      profile.principal_id,access.scope_object(membership.organization_id) membership_scope,
      exists(select 1 from identity.realmtarget binding where binding.realm_id=membership.realm_id
        and binding.surface='admin' and binding.membership_client='operator') realm_binding,
      exists(select 1 from identity.realmtarget binding where binding.realm_id=membership.realm_id
        and binding.surface='admin' and binding.membership_client='operator'
        and binding.membership_organization_id=membership.organization_id) organization_binding,
      exists(select 1 from access.platformowner owner where owner.singleton=true and owner.state='active'
        and owner.membership_id=membership.id) is_owner
    into target
  from access.membership membership
  join member.profile profile on profile.id=membership.member_id
  where membership.id=p_target_membership_id and membership.client='operator' and membership.status='active'
  for update of membership;
  if not found then raise exception 'ADMINISTRATOR_NOT_ACTIVE'; end if;
  if target.realm_id is null or actor.realm_id is null or target.realm_id<>actor.realm_id
    or not target.realm_binding then
    raise exception 'MANAGEMENT_PERMISSION_REALM_MISMATCH';
  end if;
  if not target.organization_binding or target.membership_scope is null
    or actor.scope_organization_id is distinct from coalesce(
      target.membership_scope->>'tenant',target.membership_scope->>'id') then
    raise exception 'MANAGEMENT_PERMISSION_ORGANIZATION_MISMATCH';
  end if;
  if target.is_owner then raise exception 'OWNER_ROLE_LEVEL_IMMUTABLE'; end if;
  select governance.governance_level into target_governance
  from access.resolve_authoritative_governance(
    target.id,target.principal_id,p_scope_kind,p_scope_id) governance;
  if not found then raise exception 'ADMINISTRATOR_NOT_ACTIVE'; end if;
  if actor.governance_level='senior_administrator' and target_governance is distinct from 'administrator' then
    raise exception 'OWNER_REQUIRED_FOR_ADMINISTRATOR_OFFBOARDING';
  end if;
  if target.access_version<>p_expected_access_version then raise exception 'VERSION_CONFLICT'; end if;

  changed_at:=clock_timestamp();
  update access.membershiprole set expires_at=changed_at
    where membership_id=target.id and effective_at<=changed_at and (expires_at is null or expires_at>changed_at);
  update access.scopegrant set expires_at=changed_at
    where membership_id=target.id and effective_at<=changed_at and (expires_at is null or expires_at>changed_at);
  update access.membershipoverride set revoked_at=changed_at
    where membership_id=target.id and revoked_at is null and effective_at<=changed_at
      and (expires_at is null or expires_at>changed_at);
  update access.administratorsegmentscope scope set status='revoked',revoked_at=changed_at
    from access.administratoridentity identity where identity.membership_id=target.id
      and scope.administrator_identity_id=identity.id and scope.status='active';
  update access.administratoridentity set status='revoked',revoked_at=changed_at,version=version+1
    where membership_id=target.id and status='active';
  update identity.session set revoked_at=changed_at,revoked_reason='administrator_offboarded'
    where membership_id=target.id and revoked_at is null;
  -- The access Membership schema calls a departed OP "left"; the HTTP receipt
  -- retains its existing "offboarded" wording for callers.
  update access.membership set status='left',left_at=changed_at,access_version=access_version+1
    where id=target.id and client='operator' and status='active' and access_version=p_expected_access_version
    returning access_version into changed_version;
  if not found then raise exception 'VERSION_CONFLICT'; end if;
  return changed_version;
end
$function$;

revoke all on function access.offboard_administrator(text,text,text,text,bigint) from public;
grant execute on function access.offboard_administrator(text,text,text,text,bigint) to zhudatuanidentityapi;

insert into runtime.schemaversion(version,checksum)
values('20260917130000',encode(public.digest('offboard-operator-identity:v1','sha256'),'hex'));

commit;
