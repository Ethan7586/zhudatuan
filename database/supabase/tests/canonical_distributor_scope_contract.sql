begin;

do $$
<<canonical_distributor_scope_contract>>
declare
  suffix text := substr(replace(gen_random_uuid()::text,'-',''),1,10);
  membership_id text := 'contract-distributor-membership-'||suffix;
  member_id text := 'contract-distributor-member-'||suffix;
  user_id text := 'contract-distributor-user-'||suffix;
  other_membership_id text := 'contract-distributor-other-membership-'||suffix;
  other_member_id text := 'contract-distributor-other-member-'||suffix;
  other_user_id text := 'contract-distributor-other-user-'||suffix;
  first_created jsonb; second_created jsonb; center jsonb; scope_path jsonb; resolved jsonb;
  first_id text; first_org_id text; second_id text; platform_id text;
  error_message text; tested_scope_kind text; version_before integer; other_version_before integer;
begin
  first_created:=public.api_platform_create_distributor(
    'membership-test-owner-admin','user-test-owner','canon_'||suffix,
    '契约分销商一','{}'::jsonb,'manual','{}'::jsonb,'验证规范分销范围',
    'canonical-create-one-'||suffix,'hash-canonical-create-one-'||suffix,
    'canonical-create-one','contract-test'
  );
  first_id:=first_created#>>'{distributor,id}';
  first_org_id:=first_created#>>'{distributor,orgUnitId}';
  perform public.api_platform_attach_tenant_to_distributor(
    'membership-test-owner-admin','user-test-owner',first_id,'tenant-smart-wing',
    now(),null,'{"contract":true}'::jsonb,'验证规范分销范围',
    'canonical-attach-one-'||suffix,'hash-canonical-attach-one-'||suffix,
    'canonical-attach-one','contract-test'
  );
  second_created:=public.api_platform_create_distributor(
    'membership-test-owner-admin','user-test-owner','ambiguity_'||suffix,
    '契约分销商二','{}'::jsonb,'manual','{}'::jsonb,'验证冲突分销范围',
    'canonical-create-two-'||suffix,'hash-canonical-create-two-'||suffix,
    'canonical-create-two','contract-test'
  );
  second_id:=second_created#>>'{distributor,id}';

  insert into public.users (
    id,tenant_id,enterprise_id,employee_no,display_name,identity_subject,status
  ) values (
    user_id,'tenant-smart-wing','enterprise-demo','DIST-'||suffix,
    '分销范围契约用户','contract:distributor:'||suffix,'active'
  );
  insert into public.members (id,user_id,primary_identifier,status)
  values (member_id,user_id,'contract:distributor:'||suffix,'active');
  insert into public.memberships (
    id,member_id,context_user_id,tenant_id,enterprise_id,mall_id,target,status
  ) values (
    membership_id,member_id,user_id,'tenant-smart-wing','enterprise-demo','mall-demo','admin','active'
  );
  insert into public.users(id,tenant_id,enterprise_id,employee_no,display_name,identity_subject,status)
  values(other_user_id,'tenant-smart-wing','enterprise-demo','DIST-OTHER-'||suffix,
    '分销范围转移契约用户','contract:distributor:other:'||suffix,'active');
  insert into public.members(id,user_id,primary_identifier,status)
  values(other_member_id,other_user_id,'contract:distributor:other:'||suffix,'active');
  insert into public.memberships(id,member_id,context_user_id,tenant_id,enterprise_id,mall_id,target,status)
  values(other_membership_id,other_member_id,other_user_id,'tenant-smart-wing','enterprise-demo','mall-demo','admin','active');
  insert into public.membership_roles(membership_id,role_id,granted_by_membership_id)
  values(membership_id,'role-enterprise-manager-v2','membership-test-owner-admin');
  insert into public.role_permissions(role_id,permission_id)
  select 'role-enterprise-manager-v2',id from public.permissions where code='distributor.read'
  on conflict do nothing;

  begin
    insert into public.membership_scopes(membership_id,scope_kind,resource_id)
    values(membership_id,'distributor',first_org_id);
    raise exception 'CONTRACT_LEGACY_DISTRIBUTOR_SCOPE_ACCEPTED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%MEMBERSHIP_SCOPE_OUTSIDE_TENANT%' then raise; end if;
  end;
  insert into public.membership_scopes(membership_id,scope_kind,resource_id)
  values(membership_id,'distributor',first_id);
  insert into public.membership_scopes(membership_id,scope_kind,resource_id)
  values(membership_id,'enterprise','enterprise-demo');
  select authz_version into version_before from public.memberships where id=membership_id;
  select authz_version into other_version_before from public.memberships where id=other_membership_id;
  update public.membership_scopes scope
  set membership_id=canonical_distributor_scope_contract.other_membership_id
  where scope.membership_id=canonical_distributor_scope_contract.membership_id
    and scope_kind='enterprise' and resource_id='enterprise-demo';
  if (select authz_version from public.memberships where id=membership_id)<=version_before
     or (select authz_version from public.memberships where id=other_membership_id)<=other_version_before
  then raise exception 'CONTRACT_SCOPE_TRANSFER_DID_NOT_INVALIDATE_BOTH_MEMBERSHIPS'; end if;
  update public.membership_scopes scope
  set membership_id=canonical_distributor_scope_contract.membership_id
  where scope.membership_id=canonical_distributor_scope_contract.other_membership_id
    and scope.scope_kind='enterprise' and scope.resource_id='enterprise-demo';
  if not public.api_membership_scope_allows(
       membership_id,'tenant-smart-wing','enterprise-demo','mall-demo'
     ) or not public.api_actor_can_grant_scope(membership_id,'distributor',first_id)
  then raise exception 'CONTRACT_CANONICAL_DISTRIBUTOR_SCOPE_REJECTED'; end if;
  if not public.api_actor_can_grant_scope(membership_id,'enterprise','enterprise-demo')
  then raise exception 'CONTRACT_DISTRIBUTOR_DESCENDANT_SCOPE_REJECTED'; end if;
  foreach tested_scope_kind in array array[
    'tenant','enterprise','mall','supplier','brand','store','department','self'
  ] loop
    if public.api_actor_can_grant_scope(membership_id,tested_scope_kind,'attacker-controlled')
    then raise exception 'CONTRACT_DISTRIBUTOR_ARBITRARY_SCOPE_ALLOWED'; end if;
  end loop;

  center:=public.api_permission_command_center(
    'membership-test-owner-admin','tenant-smart-wing','enterprise-demo','mall-demo',false
  );
  if not exists(
       select 1 from jsonb_array_elements(center#>'{scopeOptions,distributor}') option
       where option->>'id'=first_id
     ) or exists(
       select 1 from jsonb_array_elements(center#>'{scopeOptions,distributor}') option
       where option->>'id'=first_org_id
     )
  then raise exception 'CONTRACT_PERMISSION_CENTER_DISTRIBUTOR_ID_INVALID'; end if;

  scope_path:=public.api_org_unit_scope_path('mall','mall-demo');
  if not exists(select 1 from jsonb_array_elements(scope_path) node
       where node->>'kind'='distributor' and node->>'resourceId'=first_id)
     or exists(select 1 from jsonb_array_elements(scope_path) node
       where node->>'kind'='distributor' and node->>'resourceId'=first_org_id)
  then raise exception 'CONTRACT_HIERARCHY_DISTRIBUTOR_ID_INVALID'; end if;

  center:=public.api_distributor_center(membership_id,user_id,first_id,null);
  if center->>'distributorId'<>first_id
  then raise exception 'CONTRACT_DISTRIBUTOR_CENTER_SCOPE_REJECTED'; end if;
  select authz_version into version_before from public.memberships where id=membership_id;
  update public.distributor_tenants set starts_at=now()-interval '2 hours',
    ends_at=now()-interval '1 hour' where distributor_id=first_id and tenant_id='tenant-smart-wing';
  alter table public.membership_scopes disable trigger membership_scopes_validate;
  update public.membership_scopes scope set resource_id=first_org_id
  where scope.membership_id=canonical_distributor_scope_contract.membership_id
    and scope.scope_kind='distributor' and scope.resource_id=first_id;
  alter table public.membership_scopes enable trigger membership_scopes_validate;
  perform public.repair_canonical_distributor_scopes();
  if not exists(
       select 1 from public.membership_scopes scope
       where scope.membership_id=canonical_distributor_scope_contract.membership_id
         and scope.scope_kind='distributor' and scope.resource_id=first_org_id
     ) or (select status from public.memberships where id=membership_id)<>'active'
  then raise exception 'CONTRACT_STALE_DISTRIBUTOR_TOMBSTONE_REMOVED'; end if;
  resolved:=public.api_resolve_membership_context(member_id,membership_id,'admin');
  if (select authz_version from public.memberships where id=membership_id)<=version_before
     or resolved is not null
     or public.api_membership_scope_allows(
       membership_id,'tenant-smart-wing','enterprise-demo','mall-demo'
     )
     or public.api_actor_can_grant_scope(membership_id,'enterprise','enterprise-demo')
     or public.api_membership_actor_matches(membership_id,user_id,'admin')
     or public.api_voucher_membership_scope_allows(
       membership_id,'tenant-smart-wing','enterprise-demo','mall-demo'
     )
     or public.api_mall_application_actor_access(
       membership_id,'tenant-smart-wing','enterprise-demo','mall-demo',false
     )
     or public.api_distributor_actor_has_permission(membership_id,'distributor.read')
     or public.api_org_unit_scope_path('mall','mall-demo')<>'[]'::jsonb
  then raise exception 'CONTRACT_EXPIRED_DISTRIBUTOR_SCOPE_PROJECTED'; end if;
  begin
    perform public.api_distributor_center(membership_id,user_id,first_id,null);
    raise exception 'CONTRACT_EXPIRED_DISTRIBUTOR_CENTER_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%DISTRIBUTOR_SCOPE_FORBIDDEN%' then raise; end if;
  end;
  update public.distributor_tenants set starts_at=now()-interval '1 minute',ends_at=null
  where distributor_id=first_id and tenant_id='tenant-smart-wing';
  perform public.repair_canonical_distributor_scopes();
  resolved:=public.api_resolve_membership_context(member_id,membership_id,'admin');
  if not exists(select 1 from jsonb_array_elements(resolved->'scopeBindings') binding
       where binding->>'kind'='distributor' and binding->>'resourceId'=first_id)
  then raise exception 'CONTRACT_REACTIVATED_DISTRIBUTOR_SCOPE_MISSING'; end if;
  select authz_version into version_before from public.memberships where id=membership_id;
  update public.distributors set status='suspended' where id=first_id;
  if (select authz_version from public.memberships where id=membership_id)<=version_before
     or public.api_actor_can_grant_scope(membership_id,'enterprise','enterprise-demo')
     or public.api_resolve_membership_context(member_id,membership_id,'admin') is not null
  then raise exception 'CONTRACT_SUSPENDED_DISTRIBUTOR_ANCHOR_ALLOWED'; end if;
  update public.distributors set status='active' where id=first_id;

  -- Simulate a pre-constraint database containing two individually valid
  -- distributor relations. Authorization must still fail closed.
  drop index public.membership_scopes_one_distributor;
  drop index public.distributor_tenants_one_active_owner;
  insert into public.distributor_tenants(distributor_id,tenant_id,status)
  values(second_id,'tenant-smart-wing','active');
  insert into public.membership_scopes(membership_id,scope_kind,resource_id)
  values(membership_id,'distributor',second_id);
  if public.api_membership_scope_allows(
       membership_id,'tenant-smart-wing','enterprise-demo','mall-demo'
     ) or public.api_actor_can_grant_scope(membership_id,'distributor',first_id)
  then raise exception 'CONTRACT_AMBIGUOUS_DISTRIBUTOR_SCOPE_ALLOWED'; end if;
  perform public.repair_canonical_distributor_scopes();
  if (select status from public.memberships where id=membership_id)<>'suspended'
     or exists(
       select 1 from public.membership_scopes scope
       where scope.membership_id=canonical_distributor_scope_contract.membership_id
     )
     or public.api_membership_actor_matches(membership_id,user_id,'admin')
     or public.api_membership_scope_allows(
       membership_id,'tenant-smart-wing','enterprise-demo','mall-demo'
     )
     or not exists(
       select 1 from public.audit_logs audit
       where audit.membership_id=canonical_distributor_scope_contract.membership_id
         and audit.action='membership.distributor_scope.ambiguous_quarantined'
     )
  then raise exception 'CONTRACT_AMBIGUOUS_DISTRIBUTOR_REPAIR_FAILED_OPEN'; end if;
  delete from public.distributor_tenants
  where distributor_id=second_id and tenant_id='tenant-smart-wing';
  create unique index membership_scopes_one_distributor
  on public.membership_scopes(membership_id) where scope_kind='distributor';
  create unique index distributor_tenants_one_active_owner
  on public.distributor_tenants(tenant_id) where status='active';

  delete from public.membership_scopes scope
  where scope.membership_id=canonical_distributor_scope_contract.membership_id
    and scope.scope_kind='distributor';
  select id into strict platform_id from public.org_units
  where kind='platform' and status='active' order by id limit 1;
  update public.org_units set status='disabled' where id=platform_id;
  if public.api_actor_can_grant_scope(
       'membership-test-owner-admin','platform',platform_id
     ) or public.api_distributor_actor_is_platform(
       'membership-test-owner-admin','user-test-owner'
     )
     or public.api_membership_distributor_anchor_valid('membership-test-owner-admin')
     or public.api_actor_can_grant_scope(
       'membership-test-owner-admin','enterprise','enterprise-demo'
     )
  then raise exception 'CONTRACT_DISABLED_PLATFORM_SCOPE_ALLOWED'; end if;
  update public.org_units set status='active' where id=platform_id;
end;
$$;

rollback;
