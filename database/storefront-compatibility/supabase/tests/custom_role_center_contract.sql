begin;

do $$
declare created jsonb; updated jsonb; disabled jsonb; custom_role_id text; before_version bigint; after_version bigint;
  brand_id text:='brand-contract-'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
  store_id text:='store-contract-'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
begin
  created:=public.api_create_custom_role(
    'membership-test-owner-admin','user-test-owner','tenant-smart-wing','enterprise-demo','mall-demo',
    'contract_role_'||substr(replace(gen_random_uuid()::text,'-',''),1,8),'契约自定义角色','契约测试创建与生命周期',
    array['member.read','role.read'],null,'契约测试创建角色','role-create-contract','contract-test','{}'::jsonb
  );
  custom_role_id:=created->>'id';
  if created->>'status'<>'active' or not exists(select 1 from public.roles where id=custom_role_id and not is_owner and not is_system and is_editable) then raise exception 'CONTRACT_CUSTOM_ROLE_NOT_CREATED'; end if;

  insert into public.membership_roles(membership_id,role_id,granted_by_membership_id)
  values('membership-test-admin-001',custom_role_id,'membership-test-owner-admin');
  select authz_version into before_version from public.memberships where id='membership-test-admin-001';
  updated:=public.api_update_custom_role(
    'membership-test-owner-admin','user-test-owner','tenant-smart-wing','enterprise-demo','mall-demo',
    custom_role_id,'契约角色新名称','契约测试权限更新',array['member.read','role.read','audit.read'],
    '契约测试编辑角色','role-update-contract','contract-test','{}'::jsonb
  );
  select authz_version into after_version from public.memberships where id='membership-test-admin-001';
  if after_version<=before_version or not exists(select 1 from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where rp.role_id=custom_role_id and p.code='audit.read') then raise exception 'CONTRACT_ROLE_UPDATE_DID_NOT_INVALIDATE'; end if;

  disabled:=public.api_set_custom_role_status(
    'membership-test-owner-admin','user-test-owner','tenant-smart-wing','enterprise-demo','mall-demo',
    custom_role_id,'disabled','契约测试停用角色','role-disable-contract','contract-test','{}'::jsonb
  );
  if disabled->>'status'<>'disabled' or (disabled->>'revokedAssignments')::integer<1 or exists(select 1 from public.membership_roles mr where mr.role_id=custom_role_id and mr.revoked_at is null) then raise exception 'CONTRACT_ROLE_DISABLE_DID_NOT_REVOKE'; end if;

  begin
    perform public.api_create_custom_role(
      'membership-test-owner-admin','user-test-owner','tenant-smart-wing','enterprise-demo','mall-demo',
      'owner_copy_'||substr(replace(gen_random_uuid()::text,'-',''),1,8),'非法Owner复制','不能复制Owner',null,
      'role-platform-owner-v2','契约测试Owner保护','role-owner-contract','contract-test','{}'::jsonb
    );
    raise exception 'CONTRACT_OWNER_ROLE_CLONED';
  exception when others then if sqlerrm not like '%OWNER_ROLE_PROTECTED%' then raise; end if; end;

  begin
    perform public.api_create_custom_role(
      'membership-test-admin-001','user-test-admin-001','tenant-smart-wing','enterprise-demo','mall-demo',
      'escalation_'||substr(replace(gen_random_uuid()::text,'-',''),1,8),'非法提权角色','不能超过操作者权限',array['tenant.manage'],null,
      '契约测试越权保护','role-escalation-contract','contract-test','{}'::jsonb
    );
    raise exception 'CONTRACT_ROLE_ESCALATION_ALLOWED';
  exception when others then if sqlerrm not like '%ROLE_GRANT_EXCEEDS_ACTOR%' then raise; end if; end;

  insert into public.brands(id,tenant_id,code,name,status) values(brand_id,'tenant-smart-wing',brand_id,'契约品牌','active');
  insert into public.stores(id,tenant_id,code,name,status) values(store_id,'tenant-smart-wing',store_id,'契约门店','active');
  if not public.api_actor_can_grant_scope('membership-test-owner-admin','brand',brand_id)
    or not public.api_actor_can_grant_scope('membership-test-owner-admin','store',store_id) then raise exception 'CONTRACT_COMMERCIAL_SCOPES_NOT_GRANTABLE'; end if;
  perform public.api_update_membership_access(
    'membership-test-owner-admin','user-test-owner','tenant-smart-wing','enterprise-demo','mall-demo',
    'membership-test-admin-001',array['role-test-admin'],
    jsonb_build_array(jsonb_build_object('kind','brand','resourceId',brand_id),jsonb_build_object('kind','store','resourceId',store_id)),
    '{}'::text[],'契约测试完整数据范围','scope-contract','contract-test','{}'::jsonb
  );
  if not exists(select 1 from public.membership_scopes s where s.membership_id='membership-test-admin-001' and s.scope_kind='brand' and s.resource_id=brand_id)
    or not exists(select 1 from public.membership_scopes s where s.membership_id='membership-test-admin-001' and s.scope_kind='store' and s.resource_id=store_id) then raise exception 'CONTRACT_COMMERCIAL_SCOPE_WRITE_FAILED'; end if;
end;
$$;

rollback;
