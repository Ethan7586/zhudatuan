begin;

select pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-invitation-history:v1'));

do $precondition$
begin
  if not exists(select 1 from runtime.schemaversion
      where version='20260903100000'
        and checksum='9942a46274ce8717f79b0878ac1deaa590650c0eb0fca29676424b8d0da54c43')
    or exists(select 1 from runtime.schemaversion where version>'20260903100000') then
    raise exception 'PLATFORM_OWNER_INVITATION_HISTORY_PREDECESSOR_INVALID';
  end if;
end
$precondition$;

create or replace function access.zhudatuan_operator_invitation_allowed(
  p_role_id text,
  p_create boolean
)
returns boolean language sql stable
set search_path=pg_catalog,pg_temp as $function$
  select current_user in('shopapp','zhudatuanidentityapi')
    and (
      (governance.scope_kind='tenant'
        and governance.scope_semantic_id=governance.organization_id)
      or (
        governance.is_exact_owner
        and governance.scope_kind='platform'
        and exists(
          select 1 from organization.unitclosure boundary
          where boundary.ancestor_id=governance.scope_organization_id
            and boundary.descendant_id=governance.organization_id
        )
      )
    )
    and (p_role_id='role-zhudatuan-pending-operator'
      or p_role_id='role-senior-administrator-v1:'||governance.organization_id)
    and (governance.is_exact_owner or governance.governance_level='senior_administrator')
    and (not p_create or governance.is_exact_owner
      or p_role_id='role-zhudatuan-pending-operator')
    and exists(
      select 1 from access.rolepermission mapping
      join access.permission permission on permission.id=mapping.permission_id
      where mapping.role_id=case when governance.is_exact_owner then 'role-platform-owner-v2'
          else 'role-senior-administrator-v1:'||governance.organization_id end
        and mapping.effect='allow'
        and permission.code='identity.invitation.manage'
        and permission.status='active'
        and not exists(
          select 1 from access.membershipoverride denied
          where denied.membership_id=governance.actor_membership_id
            and denied.permission_id=permission.id
            and denied.effect='deny'
            and denied.revoked_at is null
            and denied.effective_at<=governance.resolved_at
            and (denied.expires_at is null or denied.expires_at>governance.resolved_at)
        )
    )
  from access.resolve_governance(
    nullif(current_setting('app.membership_id',true),''),
    nullif(current_setting('app.actor_id',true),''),
    null,
    nullif(current_setting('app.scope_id',true),'')
  ) governance
$function$;

insert into runtime.schemaversion(version,checksum)
values('20260903101000','9fda96e5366b237ab082e0217e5bfb48f8cda0632293df68a1e282c8a886cbc7');

commit;
