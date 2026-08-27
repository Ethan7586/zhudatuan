-- Reconcile the environment bootstrap with the single-active-platform-owner
-- invariant without rewriting the historical bootstrap migration.

do $$
declare
  canonical_owner record;
  platform_org_unit_id text;
  suspended_memberships integer := 0;
  suspended_members integer := 0;
  disabled_users integer := 0;
begin
  select membership.id, membership.context_user_id, membership.tenant_id,
         membership.enterprise_id, membership.mall_id
    into canonical_owner
  from public.memberships membership
  join public.membership_roles assignment
    on assignment.membership_id=membership.id
   and assignment.revoked_at is null
   and (assignment.expires_at is null or assignment.expires_at>now())
  join public.roles role
    on role.id=assignment.role_id
   and role.code='platform_owner'
   and role.is_owner
   and role.status='active'
  join public.members member
    on member.id=membership.member_id and member.status='active'
  join public.member_login_aliases alias
    on alias.member_id=member.id
   and alias.provider='local_username'
   and alias.subject='ethan'
  join public.users actor
    on actor.id=membership.context_user_id and actor.status='active'
  where membership.target='admin'
    and membership.status='active'
    and (membership.expires_at is null or membership.expires_at>now());

  if canonical_owner.id is null then
    raise exception 'CANONICAL_PLATFORM_OWNER_NOT_FOUND';
  end if;

  select platform.id into platform_org_unit_id
  from public.org_units tenant_node
  join public.org_unit_closure path on path.descendant_id=tenant_node.id
  join public.org_units platform on platform.id=path.ancestor_id
  where tenant_node.source_type='tenant'
    and tenant_node.source_id=canonical_owner.tenant_id
    and tenant_node.status='active'
    and platform.kind='platform'
    and platform.status='active';
  if platform_org_unit_id is null then
    raise exception 'CANONICAL_PLATFORM_ORG_UNIT_NOT_FOUND';
  end if;

  insert into public.membership_scopes (membership_id,scope_kind,resource_id)
  values
    (canonical_owner.id,'platform',platform_org_unit_id),
    (canonical_owner.id,'tenant',canonical_owner.tenant_id)
  on conflict do nothing;

  alter table public.memberships disable trigger memberships_protect_owner;
  update public.memberships membership
  set status='suspended'
  where membership.id like 'membership-test-%'
    and membership.status='active'
    and membership.id<>canonical_owner.id;
  get diagnostics suspended_memberships = row_count;
  alter table public.memberships enable trigger memberships_protect_owner;

  update public.members member
  set status='suspended',updated_at=now()
  where member.id like 'member-test-%' and member.status='active';
  get diagnostics suspended_members = row_count;

  update public.users actor
  set status='disabled',updated_at=now()
  where actor.id like 'user-test-%' and actor.status<>'disabled';
  get diagnostics disabled_users = row_count;

  insert into public.audit_logs (
    id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,
    resource_type,resource_id,request_id,user_agent,after_json
  ) values (
    gen_random_uuid()::text,canonical_owner.tenant_id,
    canonical_owner.enterprise_id,canonical_owner.mall_id,
    canonical_owner.context_user_id,'system','identity.test_fixtures.suspended',
    'membership',canonical_owner.id,
    'migration:20260820132000','database-migration',
    jsonb_build_object(
      'platformOrgUnitId',platform_org_unit_id,
      'suspendedMemberships',suspended_memberships,
      'suspendedMembers',suspended_members,
      'disabledUsers',disabled_users
    )
  );

  if (
    select count(distinct membership.id)
    from public.memberships membership
    join public.membership_roles assignment
      on assignment.membership_id=membership.id
     and assignment.revoked_at is null
     and (assignment.expires_at is null or assignment.expires_at>now())
    join public.roles role
      on role.id=assignment.role_id
     and role.is_owner and role.status='active'
    where membership.target='admin'
      and membership.status='active'
      and (membership.expires_at is null or membership.expires_at>now())
  )<>1 then
    raise exception 'ACTIVE_PLATFORM_OWNER_NOT_UNIQUE';
  end if;
end;
$$;

notify pgrst, 'reload schema';
