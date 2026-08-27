begin;

do $$
begin
  if (select count(distinct membership.id)
      from public.memberships membership
      join public.membership_roles membership_role on membership_role.membership_id=membership.id and membership_role.revoked_at is null
      join public.roles role on role.id=membership_role.role_id and role.is_owner)<>1 then
    raise exception 'CONTRACT_OWNER_MEMBERSHIP_NOT_UNIQUE';
  end if;

  if not exists(
    select 1 from public.membership_scopes scope
    join public.org_units platform on platform.id=scope.resource_id and platform.kind='platform'
    where scope.membership_id='membership-test-owner-admin' and scope.scope_kind='platform'
  ) or not public.api_actor_can_grant_scope('membership-test-owner-admin','platform','org-platform-smart-wing') then
    raise exception 'CONTRACT_OWNER_PLATFORM_SCOPE_MISSING';
  end if;

  begin
    insert into public.membership_scopes(membership_id,scope_kind,resource_id)
    values('membership-test-admin-001','platform','org-platform-smart-wing');
    raise exception 'CONTRACT_NON_OWNER_PLATFORM_SCOPE_ALLOWED';
  exception when others then
    if sqlerrm not like '%PLATFORM_SCOPE_REQUIRES_OWNER%' then raise; end if;
  end;
end;
$$;

rollback;
