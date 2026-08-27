begin;

do $$
declare
  suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  session_id uuid := gen_random_uuid();
  factor_id text := 'contract-order-export-mfa-' || suffix;
  challenge_id text := 'contract-order-export-step-up-' || suffix;
  export_request_id text := 'contract-order-export-' || suffix;
  verified_at timestamptz := clock_timestamp();
  authz_version integer;
  credential_version integer;
  order_page_evidence jsonb;
  after_sale_page_evidence jsonb;
  export_evidence jsonb;
  page_result jsonb;
  export_result jsonb;
  error_message text;
begin
  select membership.authz_version, credential.credential_version
  into strict authz_version, credential_version
  from public.memberships membership
  left join public.member_credentials credential
    on credential.member_id = membership.member_id
  where membership.id = 'membership-test-owner-admin';

  insert into public.auth_sessions (
    id, member_id, membership_id, target, credential_version, ip_hash,
    user_agent, device_label, expires_at
  ) values (
    session_id, 'member-test-owner', 'membership-test-owner-admin', 'admin',
    credential_version, 'contract-order-export-ip', 'contract-test',
    'contract-test', now() + interval '1 hour'
  );
  insert into public.admin_mfa_factors (
    id, tenant_id, user_id, factor_type, secret_ciphertext, label, status
  ) values (
    factor_id, 'tenant-smart-wing', 'user-test-owner', 'totp',
    repeat('b', 32), 'Order export contract factor', 'active'
  ) on conflict (user_id, factor_type) do update set status = 'active'
  returning id into factor_id;
  insert into public.admin_step_up_challenges (
    id, membership_id, user_id, session_id, factor_id, status, attempts,
    request_id, created_at, expires_at, verified_at, updated_at
  ) values (
    challenge_id, 'membership-test-owner-admin', 'user-test-owner',
    session_id::text, factor_id, 'verified', 0, export_request_id,
    verified_at, verified_at + interval '5 minutes', verified_at, verified_at
  );

  order_page_evidence := jsonb_build_object(
    'sessionId', session_id,
    'membershipId', 'membership-test-owner-admin',
    'authzVersion', authz_version,
    'permission', 'order.read',
    'stepUpAt', null
  );
  after_sale_page_evidence := order_page_evidence
    || jsonb_build_object('permission', 'aftersale.read');
  export_evidence := order_page_evidence || jsonb_build_object(
    'permission', 'order.export', 'stepUpAt', verified_at
  );

  page_result := public.api_admin_order_management_page_authorized(
    'orders', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', null,
    null, null, null, null, 'created_at_desc', 20, 0,
    'user-test-owner', 'membership-test-owner-admin', order_page_evidence
  );
  if jsonb_typeof(page_result) <> 'object'
     or jsonb_typeof(page_result->'items') <> 'array'
  then raise exception 'CONTRACT_ADMIN_ORDER_PAGE_INVALID'; end if;

  page_result := public.api_admin_order_management_page_authorized(
    'after_sales', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', null,
    null, null, null, null, 'created_at_desc', 20, 0,
    'user-test-owner', 'membership-test-owner-admin',
    after_sale_page_evidence
  );
  if jsonb_typeof(page_result) <> 'object'
     or jsonb_typeof(page_result->'items') <> 'array'
  then raise exception 'CONTRACT_ADMIN_AFTER_SALE_PAGE_INVALID'; end if;

  begin
    perform public.api_admin_order_management_page_authorized(
      'after_sales', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', null,
      null, null, null, null, 'created_at_desc', 20, 0,
      'user-test-seller-001', 'membership-test-seller-001', '{}'::jsonb
    );
    raise exception 'CONTRACT_AFTER_SALE_PAGE_WITHOUT_PERMISSION_ALLOWED';
  exception when others then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%ADMIN_ORDER_QUERY_NOT_AUTHORIZED%'
    then raise; end if;
  end;

  begin
    perform public.api_admin_order_management_page_authorized(
      'orders', 'tenant-smart-wing', 'enterprise-demo', 'mall-attacker', null,
      null, null, null, null, 'created_at_desc', 20, 0,
      'user-test-owner', 'membership-test-owner-admin', order_page_evidence
    );
    raise exception 'CONTRACT_ADMIN_ORDER_SCOPE_BYPASS_ALLOWED';
  exception when others then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%ADMIN_ORDER_QUERY_SCOPE_FORBIDDEN%'
    then raise; end if;
  end;

  begin
    perform public.api_admin_order_management_export_authorized(
      'orders', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', null,
      null, null, null, null, 'created_at_desc', 'user-test-admin-001',
      'membership-test-admin-001', '{}'::jsonb,
      'contract-order-export-no-permission-' || suffix
    );
    raise exception 'CONTRACT_ORDER_EXPORT_WITHOUT_PERMISSION_ALLOWED';
  exception when others then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%ADMIN_ORDER_EXPORT_NOT_AUTHORIZED%'
    then raise; end if;
  end;

  begin
    perform public.api_admin_order_management_export_authorized(
      'orders', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', null,
      null, null, null, null, 'created_at_desc', 'user-test-owner',
      'membership-test-owner-admin',
      export_evidence || jsonb_build_object('stepUpAt', null),
      'contract-order-export-no-step-up-' || suffix
    );
    raise exception 'CONTRACT_ORDER_EXPORT_WITHOUT_STEP_UP_ALLOWED';
  exception when others then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%ADMIN_ORDER_EXPORT_NOT_AUTHORIZED%'
    then raise; end if;
  end;

  export_result := public.api_admin_order_management_export_authorized(
    'orders', 'tenant-smart-wing', 'enterprise-demo', 'mall-demo', null,
    null, null, null, null, 'created_at_desc', 'user-test-owner',
    'membership-test-owner-admin', export_evidence, export_request_id
  );
  if jsonb_typeof(export_result) <> 'array'
     or not exists (
       select 1
       from public.audit_logs audit
       where audit.request_id = export_request_id
         and audit.action = 'order.export'
         and audit.resource_type = 'orders'
         and audit.membership_id = 'membership-test-owner-admin'
         and audit.granted_via->>'permission' = 'order.export'
         and (audit.after_json->>'rowCount')::integer
           = jsonb_array_length(export_result)
         and audit.after_json #>> '{filters,outcome}' in (
           'completed', 'rejected_too_large'
         )
     )
  then raise exception 'CONTRACT_ORDER_EXPORT_AUDIT_NOT_ATOMIC'; end if;

  if (select risk_level from public.permissions where code = 'order.export')
       <> 'critical'
  then raise exception 'CONTRACT_ORDER_EXPORT_NOT_CRITICAL'; end if;
  if has_function_privilege(
       'service_role',
       'public.api_admin_order_page(text,text,text,text,text,text,timestamptz,timestamptz,text,integer,integer)',
       'execute'
     )
     or has_function_privilege(
       'service_role',
       'public.api_admin_order_export(text,text,text,text,text,text,timestamptz,timestamptz,text)',
       'execute'
     )
     or has_function_privilege(
       'service_role',
       'public.api_record_order_export_audit(text,text,text,text,text,jsonb,integer,text,text,jsonb)',
       'execute'
     )
  then raise exception 'CONTRACT_LEGACY_ADMIN_ORDER_PRIMITIVE_EXECUTABLE'; end if;
end;
$$;

rollback;
