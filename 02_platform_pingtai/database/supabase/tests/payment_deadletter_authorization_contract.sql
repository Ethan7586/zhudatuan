begin;

do $$
<<deadletter_contract>>
declare
  suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  alias_membership text := 'contract-owner-alias-' || suffix;
  owner_session uuid := gen_random_uuid(); fubao_session uuid := gen_random_uuid();
  alias_session uuid := gen_random_uuid(); owner_factor text := 'contract-owner-factor-' || suffix;
  fubao_factor text := 'contract-fubao-factor-' || suffix;
  owner_challenge text := 'contract-owner-stepup-' || suffix;
  fubao_challenge text := 'contract-fubao-stepup-' || suffix;
  alias_challenge text := 'contract-alias-stepup-' || suffix;
  owner_verified timestamptz := clock_timestamp(); fubao_verified timestamptz := clock_timestamp();
  alias_verified timestamptz := clock_timestamp(); owner_authz integer; fubao_authz integer;
  alias_authz integer; owner_credential integer; fubao_credential integer;
  owner_read jsonb; owner_manage jsonb; fubao_manage jsonb; alias_manage jsonb;
  replay_order text := 'contract-deadletter-replay-order-' || suffix;
  ignore_order text := 'contract-deadletter-ignore-order-' || suffix;
  replay_payment text := 'contract-deadletter-replay-payment-' || suffix;
  ignore_payment text := 'contract-deadletter-ignore-payment-' || suffix;
  replay_attempt uuid := gen_random_uuid(); ignore_attempt uuid := gen_random_uuid();
  replay_identity uuid := gen_random_uuid(); ignore_identity uuid := gen_random_uuid();
  superseded_event uuid := gen_random_uuid(); replay_event uuid := gen_random_uuid();
  ignore_event uuid := gen_random_uuid(); response jsonb; error_message text;
  envelope_headers jsonb; envelope_version bigint;
begin
  insert into public.role_permissions (role_id, permission_id)
  select 'role-mall-admin', permission.id from public.permissions permission
  where permission.code in ('payment.outbox.read', 'payment.outbox.manage')
  on conflict do nothing;
  insert into public.memberships (
    id, member_id, context_user_id, tenant_id, enterprise_id, mall_id, target, status
  ) values (
    alias_membership, 'member-test-owner', 'user-test-owner', 'tenant-smart-wing',
    'enterprise-demo', 'mall-demo', 'admin', 'active'
  );
  insert into public.membership_roles (membership_id, role_id, granted_by_membership_id)
  values (alias_membership, 'role-mall-admin', 'membership-test-owner-admin');
  insert into public.membership_scopes (membership_id, scope_kind, resource_id)
  values (alias_membership, 'mall', 'mall-demo');

  select membership.authz_version, credential.credential_version
  into strict owner_authz, owner_credential
  from public.memberships membership left join public.member_credentials credential
    on credential.member_id = membership.member_id
  where membership.id = 'membership-test-owner-admin';
  select membership.authz_version, credential.credential_version
  into strict fubao_authz, fubao_credential
  from public.memberships membership left join public.member_credentials credential
    on credential.member_id = membership.member_id
  where membership.id = 'membership-test-fubao-admin';
  select authz_version into strict alias_authz from public.memberships
  where id = alias_membership;
  insert into public.auth_sessions (
    id, member_id, membership_id, target, credential_version, ip_hash,
    user_agent, device_label, expires_at
  ) values
    (owner_session, 'member-test-owner', 'membership-test-owner-admin', 'admin',
     owner_credential, 'contract-ip', 'contract', 'contract', now() + interval '1 hour'),
    (fubao_session, 'member-test-fubao', 'membership-test-fubao-admin', 'admin',
     fubao_credential, 'contract-ip', 'contract', 'contract', now() + interval '1 hour'),
    (alias_session, 'member-test-owner', alias_membership, 'admin', owner_credential,
     'contract-ip', 'contract', 'contract', now() + interval '1 hour');
  insert into public.admin_mfa_factors (
    id, tenant_id, user_id, factor_type, secret_ciphertext, label, status
  ) values (owner_factor, 'tenant-smart-wing', 'user-test-owner', 'totp',
    repeat('a', 32), 'Contract owner', 'active')
  on conflict (user_id, factor_type) do update set status = 'active' returning id into owner_factor;
  insert into public.admin_mfa_factors (
    id, tenant_id, user_id, factor_type, secret_ciphertext, label, status
  ) values (fubao_factor, 'tenant-smart-wing', 'user-test-fubao', 'totp',
    repeat('b', 32), 'Contract fubao', 'active')
  on conflict (user_id, factor_type) do update set status = 'active' returning id into fubao_factor;
  insert into public.admin_step_up_challenges (
    id, membership_id, user_id, session_id, factor_id, status, attempts,
    request_id, created_at, expires_at, verified_at, updated_at
  ) values
    (owner_challenge, 'membership-test-owner-admin', 'user-test-owner', owner_session::text,
     owner_factor, 'verified', 0, 'owner-stepup-' || suffix, owner_verified,
     owner_verified + interval '5 minutes', owner_verified, owner_verified),
    (fubao_challenge, 'membership-test-fubao-admin', 'user-test-fubao', fubao_session::text,
     fubao_factor, 'verified', 0, 'fubao-stepup-' || suffix, fubao_verified,
     fubao_verified + interval '5 minutes', fubao_verified, fubao_verified),
    (alias_challenge, alias_membership, 'user-test-owner', alias_session::text,
     owner_factor, 'verified', 0, 'alias-stepup-' || suffix, alias_verified,
     alias_verified + interval '5 minutes', alias_verified, alias_verified);
  owner_read := jsonb_build_object('sessionId', owner_session,
    'membershipId', 'membership-test-owner-admin', 'authzVersion', owner_authz,
    'permission', 'payment.outbox.read');
  owner_manage := owner_read || jsonb_build_object(
    'permission', 'payment.outbox.manage', 'stepUpAt', owner_verified);
  fubao_manage := jsonb_build_object('sessionId', fubao_session,
    'membershipId', 'membership-test-fubao-admin', 'authzVersion', fubao_authz,
    'permission', 'payment.outbox.manage', 'stepUpAt', fubao_verified);
  alias_manage := jsonb_build_object('sessionId', alias_session,
    'membershipId', alias_membership, 'authzVersion', alias_authz,
    'permission', 'payment.outbox.manage', 'stepUpAt', alias_verified);

  insert into public.orders (
    id, order_no, tenant_id, enterprise_id, mall_id, user_id, status,
    goods_amount_cents, discount_cents, payable_cents, paid_cents,
    recipient_snapshot_json, paid_at
  ) values
    (replay_order, 'CONTRACT-DEADLETTER-REPLAY-' || suffix, 'tenant-smart-wing',
     'enterprise-demo', 'mall-demo', 'user-test-storefront', 'paid',
     1000, 0, 1000, 1000, '{}'::jsonb, now()),
    (ignore_order, 'CONTRACT-DEADLETTER-IGNORE-' || suffix, 'tenant-smart-wing',
     'enterprise-demo', 'mall-demo', 'user-test-storefront', 'paid',
     1000, 0, 1000, 1000, '{}'::jsonb, now());
  insert into public.payments (
    id, payment_no, tenant_id, mall_id, user_id, order_id, channel, status,
    amount_cents, provider_trade_no, idempotency_key, completed_at
  ) values
    (replay_payment, 'CONTRACT-DL-PAY-R-' || suffix, 'tenant-smart-wing', 'mall-demo',
     'user-test-storefront', replay_order, 'wechat', 'succeeded', 1000,
     'CONTRACT-DL-TRADE-R-' || suffix, 'contract-dl-pay-r-' || suffix, now()),
    (ignore_payment, 'CONTRACT-DL-PAY-I-' || suffix, 'tenant-smart-wing', 'mall-demo',
     'user-test-storefront', ignore_order, 'wechat', 'succeeded', 1000,
     'CONTRACT-DL-TRADE-I-' || suffix, 'contract-dl-pay-i-' || suffix, now());
  insert into public.member_wechat_identities (id, app_id, open_id) values
    (replay_identity, 'wxdlr' || suffix, 'openid-dlr-' || suffix),
    (ignore_identity, 'wxdli' || suffix, 'openid-dli-' || suffix);
  insert into public.wechat_payment_attempts (
    id, payment_id, order_id, identity_id, created_by_membership_id, app_id,
    mch_id, out_trade_no, description, amount_total, payer_openid_hash,
    status, transaction_id, provider_trade_state, completed_at
  ) values
    (replay_attempt, replay_payment, replay_order, replay_identity,
     'membership-test-storefront', 'wxdlr' || suffix, '190000contract',
     'DLR' || upper(suffix), 'Deadletter replay', 1000, repeat('a',64),
     'succeeded', 'CONTRACT-DL-TRADE-R-' || suffix, 'SUCCESS', now()),
    (ignore_attempt, ignore_payment, ignore_order, ignore_identity,
     'membership-test-storefront', 'wxdli' || suffix, '190000contract',
     'DLI' || upper(suffix), 'Deadletter ignore', 1000, repeat('b',64),
     'succeeded', 'CONTRACT-DL-TRADE-I-' || suffix, 'SUCCESS', now());
  insert into public.payment_outbox (
    id, event_key, topic, order_id, payment_id, attempt_id, payload_json
  ) values
    (superseded_event, 'contract-dl-old:' || suffix, 'order.payment_succeeded',
     replay_order, replay_payment, replay_attempt,
     jsonb_build_object('orderId', replay_order, 'paymentId', replay_payment)),
    (replay_event, 'contract-dl-replay:' || suffix, 'order.payment_succeeded',
     replay_order, replay_payment, replay_attempt,
     jsonb_build_object('orderId', replay_order, 'paymentId', replay_payment)),
    (ignore_event, 'contract-dl-ignore:' || suffix, 'order.payment_succeeded',
     ignore_order, ignore_payment, ignore_attempt,
     jsonb_build_object('orderId', ignore_order, 'paymentId', ignore_payment));
  update public.payment_outbox set status = 'dead_letter',
    delivery_attempts = 12, last_error_code = 'CONTRACT_FAILURE',
    dead_lettered_at = now() where id in (superseded_event, replay_event, ignore_event);

  begin
    perform 1 from public.api_payment_outbox_deadletters(
      'membership-test-owner-admin', 'user-test-owner', 'tenant-smart-wing',
      'enterprise-demo', 'mall-demo', owner_read - 'sessionId', 50
    );
    raise exception 'CONTRACT_DEADLETTER_UNTRACKED_READ_ALLOWED';
  exception when others then get stacked diagnostics error_message = message_text;
    if error_message not like '%PAYMENT_OUTBOX_NOT_AUTHORIZED%' then raise; end if;
  end;
  if not exists (select 1 from public.api_payment_outbox_deadletters(
      'membership-test-owner-admin', 'user-test-owner', 'tenant-smart-wing',
      'enterprise-demo', 'mall-demo', owner_read, 50
    ) deadletter where deadletter.id = ignore_event)
  then raise exception 'CONTRACT_DEADLETTER_EXACT_SCOPE_READ_FAILED'; end if;
  begin
    perform public.api_replay_payment_deadletter(
      replay_event, 'membership-test-owner-admin', 'user-test-owner',
      'tenant-smart-wing', 'enterprise-demo', 'mall-demo',
      owner_manage - 'stepUpAt', '缺失二次认证必须拒绝',
      'contract-dl-no-stepup-' || suffix);
    raise exception 'CONTRACT_DEADLETTER_NO_STEPUP_ALLOWED';
  exception when others then get stacked diagnostics error_message = message_text;
    if error_message not like '%PAYMENT_OUTBOX_NOT_AUTHORIZED%' then raise; end if;
  end;
  begin
    perform public.api_replay_payment_deadletter(
      superseded_event, 'membership-test-owner-admin', 'user-test-owner',
      'tenant-smart-wing', 'enterprise-demo', 'mall-demo', owner_manage,
      '后续事件已存在不得重放', 'contract-dl-superseded-' || suffix);
    raise exception 'CONTRACT_DEADLETTER_SUPERSEDED_REPLAY_ALLOWED';
  exception when others then get stacked diagnostics error_message = message_text;
    if error_message not like '%PAYMENT_OUTBOX_REPLAY_SUPERSEDED%' then raise; end if;
  end;
  select headers_json, aggregate_version into strict envelope_headers, envelope_version
  from public.payment_outbox where id = replay_event;
  response := public.api_replay_payment_deadletter(
    replay_event, 'membership-test-owner-admin', 'user-test-owner',
    'tenant-smart-wing', 'enterprise-demo', 'mall-demo', owner_manage,
    '已核验证据并修复下游依赖', 'contract-dl-replay-' || suffix);
  if response->>'status' <> 'replayed'
     or (select status <> 'pending' or headers_json <> envelope_headers
         or aggregate_version <> envelope_version from public.payment_outbox
         where id = replay_event)
     or not exists (select 1 from public.audit_logs audit
       where audit.request_id = 'contract-dl-replay-' || suffix
         and audit.actor_type = 'admin' and audit.actor_user_id = 'user-test-owner'
         and audit.membership_id = 'membership-test-owner-admin')
  then raise exception 'CONTRACT_DEADLETTER_REPLAY_EVIDENCE_INVALID'; end if;
  response := public.api_replay_payment_deadletter(
    replay_event, 'membership-test-owner-admin', 'user-test-owner',
    'tenant-smart-wing', 'enterprise-demo', 'mall-demo', owner_manage,
    '已核验证据并修复下游依赖', 'contract-dl-replay-' || suffix);
  if response->>'duplicate' <> 'true' or (select count(*) from public.payment_deadletter_reviews
      where event_id = replay_event and decision = 'replay') <> 1
  then raise exception 'CONTRACT_DEADLETTER_REPLAY_NOT_IDEMPOTENT'; end if;

  response := public.api_ignore_payment_deadletter(
    ignore_event, 'membership-test-owner-admin', 'user-test-owner',
    'tenant-smart-wing', 'enterprise-demo', 'mall-demo', owner_manage,
    '确认该异常无需再次投递', 'contract-dl-ignore-owner-' || suffix);
  if response->>'status' <> 'pending_second_approval'
     or (select status from public.payment_outbox where id = ignore_event) <> 'dead_letter'
  then raise exception 'CONTRACT_DEADLETTER_FIRST_VOTE_MUTATED_EVENT'; end if;
  response := public.api_ignore_payment_deadletter(
    ignore_event, alias_membership, 'user-test-owner', 'tenant-smart-wing',
    'enterprise-demo', 'mall-demo', alias_manage, '确认该异常无需再次投递',
    'contract-dl-ignore-alias-' || suffix);
  if response->>'status' <> 'pending_second_approval' or response->>'duplicate' <> 'true'
     or (select count(*) from public.payment_deadletter_reviews
         where event_id = ignore_event and decision = 'ignore') <> 1
  then raise exception 'CONTRACT_DEADLETTER_MEMBERSHIP_SWITCH_COUNTED_TWICE'; end if;
  response := public.api_ignore_payment_deadletter(
    ignore_event, 'membership-test-fubao-admin', 'user-test-fubao',
    'tenant-smart-wing', 'enterprise-demo', 'mall-demo', fubao_manage,
    '第二人复核确认无需投递', 'contract-dl-ignore-fubao-' || suffix);
  if response->>'status' <> 'ignored' or response->>'approvals' <> '2'
     or (select status from public.payment_outbox where id = ignore_event) <> 'ignored'
     or (select count(distinct actor_member_id) from public.payment_deadletter_reviews
         where event_id = ignore_event and decision = 'ignore') <> 2
     or not exists (select 1 from public.audit_logs audit
       where audit.request_id = 'contract-dl-ignore-fubao-' || suffix
         and audit.action = 'payment.outbox.ignored'
         and audit.actor_user_id = 'user-test-fubao'
         and audit.membership_id = 'membership-test-fubao-admin')
     or (select count(*) from public.audit_logs audit
         where audit.action = 'payment.outbox.ignore_approved'
           and audit.resource_id = ignore_order) <> 2
  then raise exception 'CONTRACT_DEADLETTER_DUAL_CONTROL_INVALID'; end if;
  response := public.api_ignore_payment_deadletter(
    ignore_event, 'membership-test-fubao-admin', 'user-test-fubao',
    'tenant-smart-wing', 'enterprise-demo', 'mall-demo', fubao_manage,
    '第二人复核确认无需投递', 'contract-dl-ignore-fubao-' || suffix);
  if response->>'duplicate' <> 'true'
     or (select count(*) from public.audit_logs where action = 'payment.outbox.ignored'
         and resource_id = ignore_order) <> 1
  then raise exception 'CONTRACT_DEADLETTER_IGNORE_NOT_IDEMPOTENT'; end if;

  begin
    update public.payment_deadletter_reviews set reason = '篡改审批事实'
    where event_id = ignore_event and actor_member_id = 'member-test-owner';
    raise exception 'CONTRACT_DEADLETTER_REVIEW_MUTABLE';
  exception when others then get stacked diagnostics error_message = message_text;
    if error_message not like '%payment_deadletter_reviews_IS_IMMUTABLE%' then raise; end if;
  end;
  if to_regprocedure('public.api_payment_outbox_deadletters(text,integer)') is not null
     or to_regprocedure('public.api_replay_wechat_payment_deadletter(uuid,text,text,text)') is not null
     or to_regprocedure('public.api_ignore_wechat_payment_deadletter(uuid,text,text,text)') is not null
     or to_regprocedure('public.api_replay_wechat_payment_deadletter(uuid,text,text,text,text,text,jsonb,text,text)') is not null
     or to_regprocedure('public.api_ignore_wechat_payment_deadletter(uuid,text,text,text,text,text,jsonb,text,text)') is not null
     or has_function_privilege('service_role',
       'public.internal_authorize_payment_deadletter_actor(text,text,text,text,text,text,jsonb,boolean)','execute')
     or not has_function_privilege('service_role',
       'public.api_payment_outbox_deadletters(text,text,text,text,text,jsonb,integer)','execute')
     or not has_function_privilege('service_role',
       'public.api_replay_payment_deadletter(uuid,text,text,text,text,text,jsonb,text,text)','execute')
     or not has_function_privilege('service_role',
       'public.api_ignore_payment_deadletter(uuid,text,text,text,text,text,jsonb,text,text)','execute')
     or has_function_privilege('authenticated',
       'public.api_ignore_payment_deadletter(uuid,text,text,text,text,text,jsonb,text,text)','execute')
     or has_table_privilege('service_role', 'public.payment_deadletter_reviews', 'select')
     or has_table_privilege('service_role', 'public.payment_deadletter_reviews', 'insert')
     or has_table_privilege('service_role', 'public.payment_deadletter_reviews', 'update')
     or has_table_privilege('service_role', 'public.payment_deadletter_reviews', 'delete')
     or (select risk_level from public.permissions where code = 'payment.outbox.manage') <> 'critical'
  then raise exception 'CONTRACT_DEADLETTER_ACL_INVALID'; end if;
end deadletter_contract;
$$;

rollback;
