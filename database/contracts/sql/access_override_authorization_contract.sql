begin;

do $$
declare
  v_membership constant text := 'membership:contract:accessoverride';
  v_permission constant text := 'access.override.manage';
  v_operation constant text := 'access.overrides.manage';
  v_permission_id text;
  v_snapshot record;
begin
  insert into identity.principal(id,status,created_at,updated_at,version)
  values('principal:contract:accessoverride','active',clock_timestamp(),clock_timestamp(),0);
  insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
  values('member:contract:accessoverride','principal:contract:accessoverride','Authorization contract','active',
    clock_timestamp(),clock_timestamp(),0);
  insert into access.membership(
    id,member_id,organization_id,client,status,access_version,joined_at,principal_id
  ) values(
    v_membership,'member:contract:accessoverride','organization-platform-root','operator','active',1,
    clock_timestamp(),'principal:contract:accessoverride'
  );
  insert into access.membershiprole(membership_id,role_id,effective_at)
  values(v_membership,'role-platform-owner-v2','1970-01-01T00:00:00Z');

  select p.id into strict v_permission_id
  from access.permission p
  where p.code=v_permission and p.status='active';

  if not exists(
    select 1 from access.effective_permissions(v_membership)
    where permission_code=v_permission and effect='allow'
  ) then raise exception 'CONTRACT_BASELINE_PERMISSION_NOT_ALLOWED'; end if;
  if not exists(
    select 1 from access.navigation_access(array[v_membership])
    where membership_id=v_membership and permission_code=v_permission and effect='allow'
  ) then raise exception 'CONTRACT_BASELINE_NAVIGATION_NOT_ALLOWED'; end if;

  select * into strict v_snapshot
  from access.authorization_snapshot(v_membership,'console',v_operation,null);
  if v_snapshot.credential_version<>1 or v_snapshot.organization_id<>'organization-platform-root'
    or v_snapshot.target<>'console'
    or not v_snapshot.role_assignments @> '[{"id":"role-platform-owner-v2","active":true}]'::jsonb
    or not v_permission=any(v_snapshot.permission_allows)
    or v_permission=any(v_snapshot.permission_denies)
    or not v_operation=any(v_snapshot.operation_ids)
  then raise exception 'CONTRACT_BASELINE_SNAPSHOT_NOT_ALLOWED'; end if;

  insert into access.membershipoverride(
    membership_id,permission_id,effect,granted_by,reason,effective_at,expires_at,revoked_at
  ) values(
    v_membership,v_permission_id,'deny',v_membership,'authorization contract deny',
    clock_timestamp(),null,null
  )
  on conflict(membership_id,permission_id) do update
  set effect='deny',granted_by=excluded.granted_by,reason=excluded.reason,
    effective_at=excluded.effective_at,expires_at=null,revoked_at=null;

  if not exists(
    select 1 from access.effective_permissions(v_membership)
    where permission_code=v_permission and effect='deny'
  ) or exists(
    select 1 from access.effective_permissions(v_membership)
    where permission_code=v_permission and effect='allow'
  ) then raise exception 'CONTRACT_OVERRIDE_DENY_NOT_EFFECTIVE'; end if;

  if not exists(
    select 1 from access.navigation_access(array[v_membership])
    where membership_id=v_membership and permission_code=v_permission and effect='deny'
  ) or exists(
    select 1 from access.navigation_access(array[v_membership])
    where membership_id=v_membership and permission_code=v_permission and effect='allow'
  ) then raise exception 'CONTRACT_NAVIGATION_OVERRIDE_DENY_DIVERGED'; end if;

  select * into strict v_snapshot
  from access.authorization_snapshot(v_membership,'console',v_operation,null);
  if v_permission=any(v_snapshot.permission_allows)
    or not v_permission=any(v_snapshot.permission_denies)
    or v_operation=any(v_snapshot.operation_ids)
  then raise exception 'CONTRACT_API_OVERRIDE_DENY_DIVERGED'; end if;
end
$$;

rollback;
