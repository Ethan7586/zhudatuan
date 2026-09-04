begin;

do $$
<<authorization_contract>>
declare
  suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  primary_session uuid := gen_random_uuid();
  other_session uuid := gen_random_uuid();
  factor_id text := 'contract-evidence-factor-' || suffix;
  challenge_id text := 'contract-evidence-challenge-' || suffix;
  order_id text := 'contract-evidence-order-' || suffix;
  after_sale_id text := 'contract-evidence-after-sale-' || suffix;
  verified_at timestamptz := clock_timestamp();
  authz_version integer;
  credential_version integer;
  evidence jsonb;
  error_message text;
begin
  select membership.authz_version, credential.credential_version
  into strict authz_version, credential_version
  from public.memberships membership
  join public.member_credentials credential on credential.member_id = membership.member_id
  where membership.id = 'membership-test-owner-admin';

  insert into public.auth_sessions (
    id, member_id, membership_id, target, credential_version, ip_hash,
    user_agent, device_label, expires_at
  ) values
    (primary_session, 'member-test-owner', 'membership-test-owner-admin', 'admin',
     credential_version, 'evidence-primary-ip', 'contract', 'contract-primary',
     now() + interval '1 hour'),
    (other_session, 'member-test-owner', 'membership-test-owner-admin', 'admin',
     credential_version, 'evidence-other-ip', 'contract', 'contract-other',
     now() + interval '1 hour');
  insert into public.admin_mfa_factors (
    id, tenant_id, user_id, factor_type, secret_ciphertext, label, status
  ) values (
    factor_id, 'tenant-smart-wing', 'user-test-owner', 'totp', repeat('d', 32),
    'Evidence contract factor', 'active'
  ) on conflict (user_id, factor_type) do update set status = 'active'
  returning id into factor_id;
  insert into public.admin_step_up_challenges (
    id, membership_id, user_id, session_id, factor_id, status, attempts,
    request_id, created_at, expires_at, verified_at, updated_at
  ) values (
    challenge_id, 'membership-test-owner-admin', 'user-test-owner',
    primary_session::text, factor_id, 'verified', 0, 'evidence-contract-' || suffix,
    verified_at, verified_at + interval '5 minutes', verified_at, verified_at
  );
  evidence := jsonb_build_object(
    'sessionId', primary_session,
    'membershipId', 'membership-test-owner-admin',
    'authzVersion', authz_version,
    'permission', 'order.refund.approve',
    'stepUpAt', verified_at
  );
  if not public.api_authorization_evidence_matches(
    evidence, 'membership-test-owner-admin', 'order.refund.approve', true
  ) then raise exception 'CONTRACT_VALID_AUTHORIZATION_EVIDENCE_REJECTED'; end if;

  insert into public.orders (
    id, order_no, tenant_id, enterprise_id, mall_id, user_id, status,
    goods_amount_cents, discount_cents, payable_cents, paid_cents,
    recipient_snapshot_json, paid_at
  ) values (
    order_id, 'CONTRACT-EVIDENCE-' || suffix, 'tenant-smart-wing',
    'enterprise-demo', 'mall-demo', 'user-test-storefront', 'refund_pending',
    1000, 0, 1000, 1000, '{}'::jsonb, now()
  );
  insert into public.after_sales (
    id, after_sale_no, tenant_id, mall_id, user_id, order_id, type, status,
    reason, requested_amount_cents, requested_by_membership_id,
    requested_by_member_id, order_status_before_request, migration_status
  ) values (
    after_sale_id, 'CONTRACT-EVIDENCE-AS-' || suffix, 'tenant-smart-wing',
    'mall-demo', 'user-test-storefront', order_id, 'refund_only', 'submitted',
    '验证撤销会话必须先于审批失败关闭', 1000, 'membership-test-storefront',
    'member-test-storefront', 'paid', 'ready'
  );

  update public.auth_sessions set revoked_at = now(), revoked_reason = 'contract'
  where id = primary_session;
  if public.api_authorization_evidence_matches(
    evidence, 'membership-test-owner-admin', 'order.refund.approve', true
  ) then raise exception 'CONTRACT_REVOKED_SESSION_AUTHORIZED'; end if;
  begin
    perform public.api_review_after_sale_authorized(
      'membership-test-owner-admin', 'user-test-owner', after_sale_id, 'reviewing',
      '撤销会话必须在写入前拒绝', 'contract', 'revoked-review-' || suffix,
      'revoked-review-hash-' || suffix, 'revoked-review-request-' || suffix,
      'contract', evidence
    );
    raise exception 'CONTRACT_REVOKED_SESSION_REVIEW_ALLOWED';
  exception when others then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%AFTER_SALE_REVIEWER_NOT_AUTHORIZED%' then raise; end if;
  end;
  if (select status from public.after_sales where id = after_sale_id) <> 'submitted'
     or exists(select 1 from public.after_sale_review_actions action
       where action.after_sale_id = authorization_contract.after_sale_id)
  then raise exception 'CONTRACT_REVOKED_SESSION_MUTATED_REVIEW'; end if;
  update public.auth_sessions set revoked_at = null, revoked_reason = null
  where id = primary_session;

  update public.member_credentials credential
  set credential_version = credential.credential_version + 1
  where credential.member_id = 'member-test-owner';
  if public.api_authorization_evidence_matches(
    evidence, 'membership-test-owner-admin', 'order.refund.approve', true
  ) then raise exception 'CONTRACT_STALE_CREDENTIAL_AUTHORIZED'; end if;
  update public.member_credentials credential
  set credential_version = authorization_contract.credential_version
  where credential.member_id = 'member-test-owner';

  if public.api_authorization_evidence_matches(
    evidence || jsonb_build_object('sessionId', other_session),
    'membership-test-owner-admin', 'order.refund.approve', true
  ) then raise exception 'CONTRACT_STEP_UP_REBOUND_TO_OTHER_SESSION'; end if;
  if public.api_authorization_evidence_matches(
    evidence || jsonb_build_object('authzVersion', authz_version + 1),
    'membership-test-owner-admin', 'order.refund.approve', true
  ) then raise exception 'CONTRACT_STALE_AUTHZ_VERSION_AUTHORIZED'; end if;
end
$$;

rollback;
