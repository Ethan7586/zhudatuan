begin;

do $$
declare
  suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  created jsonb;
  replayed jsonb;
  attached jsonb;
  center jsonb;
  distributor_id text;
  distributor_org_unit_id text;
  tenant_org_unit_id text;
begin
  created := public.api_platform_create_distributor(
    'membership-test-owner-admin', 'user-test-owner', 'contract_' || suffix,
    '契约测试分销商', '{}'::jsonb, 'manual', '{}'::jsonb,
    '契约测试创建分销商', 'distributor-create-' || suffix,
    'hash-create-distributor-' || suffix, 'distributor-contract-create', 'contract-test'
  );
  replayed := public.api_platform_create_distributor(
    'membership-test-owner-admin', 'user-test-owner', 'contract_' || suffix,
    '契约测试分销商', '{}'::jsonb, 'manual', '{}'::jsonb,
    '契约测试创建分销商', 'distributor-create-' || suffix,
    'hash-create-distributor-' || suffix, 'distributor-contract-replay', 'contract-test'
  );
  if created <> replayed then raise exception 'CONTRACT_DISTRIBUTOR_IDEMPOTENCY_FAILED'; end if;

  distributor_id := created->'distributor'->>'id';
  distributor_org_unit_id := created->'distributor'->>'orgUnitId';
  attached := public.api_platform_attach_tenant_to_distributor(
    'membership-test-owner-admin', 'user-test-owner', distributor_id, 'tenant-smart-wing',
    now(), null, jsonb_build_object('contract', 'test'), '契约测试挂载租户',
    'distributor-attach-' || suffix, 'hash-attach-distributor-' || suffix,
    'distributor-contract-attach', 'contract-test'
  );
  if attached->'attachment'->>'status' <> 'active' then
    raise exception 'CONTRACT_DISTRIBUTOR_ATTACHMENT_FAILED';
  end if;

  select id into tenant_org_unit_id from public.org_units
  where source_type = 'tenant' and source_id = 'tenant-smart-wing';
  if not exists (
    select 1 from public.org_unit_closure
    where ancestor_id = distributor_org_unit_id and descendant_id = tenant_org_unit_id and depth = 1
  ) then raise exception 'CONTRACT_DISTRIBUTOR_CLOSURE_MISSING'; end if;

  center := public.api_distributor_center(
    'membership-test-owner-admin', 'user-test-owner', distributor_id, null
  );
  if (center->'overview'->>'tenantCount')::integer <> 1
     or center->'overview'->'pendingCommission'->>'status' <> 'notProvisioned'
     or lower(center::text) ~ '(phone|recipient|address|member)' then
    raise exception 'CONTRACT_DISTRIBUTOR_AGGREGATE_PRIVACY_FAILED';
  end if;

  begin
    perform public.api_platform_distributors('membership-test-manager-admin', 'user-test-manager');
    raise exception 'CONTRACT_NON_PLATFORM_DISTRIBUTOR_ACCESS_ALLOWED';
  exception when others then
    if sqlerrm not like '%DISTRIBUTOR_PLATFORM_SCOPE_REQUIRED%' then raise; end if;
  end;
end;
$$;

rollback;
