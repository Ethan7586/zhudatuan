begin;
do $$
<<after_sale_contract>>
declare
  suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  session_id uuid := gen_random_uuid(); factor_id text := 'contract-mfa-' || suffix; challenge_id text := 'contract-step-up-' || suffix;
  verified_at timestamptz := clock_timestamp(); authz_version integer; credential_version integer;
  order_id text := 'contract-order-' || suffix; target_after_sale_id text := 'contract-after-sale-' || suffix;
  blocked_after_sale_id text := 'contract-after-sale-blocked-' || suffix; conflict_after_sale_id text := 'contract-after-sale-conflict-' || suffix;
  rejected_after_sale_id text := 'contract-after-sale-rejected-' || suffix; history_after_sale_id text := 'contract-after-sale-history-' || suffix;
  matrix_after_sale_id text; matrix_index integer := 0;
  current_status text; requested_transition text;
  review_evidence jsonb; refund_evidence jsonb; review_started jsonb; review_replayed jsonb; review_approved jsonb;
  replay_response jsonb := jsonb_build_object('refund', jsonb_build_object(
    'afterSaleId', 'placeholder', 'amountCents', 1000, 'status', 'succeeded'
  ), 'requestId', 'contract-refund-first');
  error_message text;
begin
  select membership.authz_version, credential.credential_version into strict authz_version, credential_version
  from public.memberships membership
  left join public.member_credentials credential on credential.member_id = membership.member_id
  where membership.id = 'membership-test-owner-admin';
  insert into public.auth_sessions (id,member_id,membership_id,target,credential_version,
    ip_hash,user_agent,device_label,expires_at) values (session_id,'member-test-owner',
    'membership-test-owner-admin','admin',credential_version,'contract-ip','contract-test','contract-test',now()+interval '1 hour');
  insert into public.admin_mfa_factors (id,tenant_id,user_id,factor_type,secret_ciphertext,label,status)
  values (factor_id,'tenant-smart-wing','user-test-owner','totp',repeat('a',32),'Contract factor','active')
  on conflict (user_id, factor_type) do update set status = 'active'
  returning id into factor_id;
  insert into public.admin_step_up_challenges (
    id, membership_id, user_id, session_id, factor_id, status, attempts,
    request_id, created_at, expires_at, verified_at, updated_at
  ) values (
    challenge_id, 'membership-test-owner-admin', 'user-test-owner', session_id::text,
    factor_id, 'verified', 0, 'contract-step-up', verified_at,
    verified_at + interval '5 minutes', verified_at, verified_at
  );
  review_evidence := jsonb_build_object(
    'sessionId', session_id,
    'membershipId', 'membership-test-owner-admin',
    'authzVersion', authz_version,
    'permission', 'order.refund.approve',
    'stepUpAt', verified_at
  );
  refund_evidence := review_evidence || jsonb_build_object('permission', 'order.refund');
  insert into public.orders (
    id, order_no, tenant_id, enterprise_id, mall_id, user_id, status,
    goods_amount_cents, discount_cents, payable_cents, paid_cents,
    recipient_snapshot_json, paid_at
  ) values (
    order_id, 'CONTRACT-ORDER-' || suffix, 'tenant-smart-wing', 'enterprise-demo',
    'mall-demo', 'user-test-storefront', 'refund_pending', 1000, 0, 1000, 1000,
    '{}'::jsonb, now()
  );
  insert into public.after_sales (
    id, after_sale_no, tenant_id, mall_id, user_id, order_id, type, status,
    reason, requested_amount_cents, requested_by_membership_id,
    requested_by_member_id, order_status_before_request, migration_status
  ) values
    (target_after_sale_id, 'CONTRACT-AS-' || suffix, 'tenant-smart-wing', 'mall-demo',
     'user-test-storefront', order_id, 'refund_only', 'submitted', '契约测试退款',
     1000, 'membership-test-storefront', 'member-test-storefront', 'paid', 'ready'),
    (blocked_after_sale_id, 'CONTRACT-AS-BLOCKED-' || suffix, 'tenant-smart-wing',
     'mall-demo', 'user-test-storefront', order_id, 'refund_only', 'submitted',
     '未审批退款必须阻止', 1000, 'membership-test-storefront',
     'member-test-storefront', 'paid', 'ready'),
    (conflict_after_sale_id, 'CONTRACT-AS-CONFLICT-' || suffix, 'tenant-smart-wing',
     'mall-demo', 'user-test-storefront', order_id, 'refund_only', 'reviewing',
     '订单状态冲突必须阻止', 1000, 'membership-test-storefront',
     'member-test-storefront', 'paid', 'ready'),
    (rejected_after_sale_id, 'CONTRACT-AS-REJECTED-' || suffix, 'tenant-smart-wing',
     'mall-demo', 'user-test-storefront', order_id, 'refund_only', 'reviewing',
     '合法拒绝必须恢复订单', 1000, 'membership-test-storefront',
     'member-test-storefront', 'paid', 'ready'),
    (history_after_sale_id, 'CONTRACT-AS-HISTORY-' || suffix, 'tenant-smart-wing',
     'mall-demo', 'user-test-storefront', order_id, 'refund_only', 'submitted',
     '历史记录必须人工核对', 1000, null, null, null, 'manual_review');
  -- Exhaust the 7 x 3 state/command matrix. Only three pairs are legal.
  foreach current_status in array array[
    'submitted', 'reviewing', 'approved', 'rejected', 'returning', 'completed', 'closed'
  ] loop
    foreach requested_transition in array array['reviewing', 'approved', 'rejected'] loop
      if (current_status = 'submitted' and requested_transition = 'reviewing')
         or (current_status = 'reviewing' and requested_transition in ('approved', 'rejected'))
      then continue; end if;
      matrix_index := matrix_index + 1;
      matrix_after_sale_id := 'contract-matrix-' || matrix_index || '-' || suffix;
      insert into public.after_sales (
        id, after_sale_no, tenant_id, mall_id, user_id, order_id, type, status,
        reason, requested_amount_cents, requested_by_membership_id,
        requested_by_member_id, order_status_before_request, migration_status
      ) values (
        matrix_after_sale_id, 'CONTRACT-MATRIX-' || matrix_index || '-' || suffix,
        'tenant-smart-wing', 'mall-demo', 'user-test-storefront', order_id,
        'refund_only', current_status, '非法状态迁移矩阵', 1000,
        'membership-test-storefront', 'member-test-storefront', 'paid', 'ready'
      );
      begin
        perform public.api_review_after_sale_authorized(
          'membership-test-owner-admin', 'user-test-owner', matrix_after_sale_id,
          requested_transition, '非法状态迁移必须失败', 'CASE-MATRIX',
          'review-matrix-' || matrix_index || '-' || suffix,
          'hash-review-matrix-' || matrix_index || '-' || suffix,
          'contract-review-matrix', 'contract-test', review_evidence
        );
        raise exception 'CONTRACT_AFTER_SALE_INVALID_TRANSITION_ALLOWED';
      exception when others then
        get stacked diagnostics error_message = message_text;
        if error_message not like '%AFTER_SALE_REVIEW_TRANSITION_INVALID%' then raise; end if;
      end;
    end loop;
  end loop;
  if matrix_index <> 18 then raise exception 'CONTRACT_AFTER_SALE_TRANSITION_MATRIX_INCOMPLETE'; end if;
  begin
    perform public.api_review_after_sale_authorized(
      'membership-test-owner-admin', 'user-test-owner', target_after_sale_id,
      'reviewing', '缺失二次认证不得审批', 'CASE-NO-STEP-UP',
      'review-no-step-up-' || suffix, 'hash-review-no-step-up-' || suffix,
      'contract-review-no-step-up', 'contract-test',
      review_evidence || jsonb_build_object('stepUpAt', null)
    );
    raise exception 'CONTRACT_AFTER_SALE_NULL_STEP_UP_ALLOWED';
  exception when others then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%AFTER_SALE_REVIEWER_NOT_AUTHORIZED%' then raise; end if;
  end;
  update public.after_sales set requested_by_member_id = 'member-test-owner'
  where id = target_after_sale_id;
  begin
    perform public.api_review_after_sale_authorized(
      'membership-test-owner-admin', 'user-test-owner', target_after_sale_id,
      'reviewing', '同一人员不同会员身份不得自审', 'CASE-SELF-MEMBER',
      'review-self-' || suffix, 'hash-review-self-' || suffix,
      'contract-review-self', 'contract-test', review_evidence
    );
    raise exception 'CONTRACT_AFTER_SALE_SAME_MEMBER_APPROVAL_ALLOWED';
  exception when others then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%AFTER_SALE_SELF_APPROVAL_FORBIDDEN%' then raise; end if;
  end;
  update public.after_sales set requested_by_member_id = 'member-test-storefront'
  where id = target_after_sale_id;
  begin
    perform public.api_review_after_sale_authorized(
      'membership-test-owner-admin', 'user-test-owner', history_after_sale_id,
      'reviewing', '历史来源不完整不得审批', 'CASE-HISTORY',
      'review-history-' || suffix, 'hash-review-history-' || suffix,
      'contract-review-history', 'contract-test', review_evidence
    );
    raise exception 'CONTRACT_AFTER_SALE_HISTORY_APPROVAL_ALLOWED';
  exception when others then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%AFTER_SALE_HISTORY_REQUIRES_REVIEW%' then raise; end if;
  end;
  review_started := public.api_review_after_sale_authorized(
    'membership-test-owner-admin', 'user-test-owner', target_after_sale_id,
    'reviewing', '开始核对售后申请', 'CASE-START', 'review-start-' || suffix,
    'hash-review-start-' || suffix, 'contract-review-start', 'contract-test',
    review_evidence
  );
  review_replayed := public.api_review_after_sale_authorized(
    'membership-test-owner-admin', 'user-test-owner', target_after_sale_id,
    'reviewing', '开始核对售后申请', 'CASE-START', 'review-start-' || suffix,
    'hash-review-start-' || suffix, 'contract-review-replay', 'contract-test',
    review_evidence
  );
  if review_started <> review_replayed
     or review_started #>> '{afterSale,status}' <> 'reviewing'
  then raise exception 'CONTRACT_AFTER_SALE_REVIEW_IDEMPOTENCY_FAILED'; end if;
  review_approved := public.api_review_after_sale_authorized(
    'membership-test-owner-admin', 'user-test-owner', target_after_sale_id,
    'approved', '订单金额与申请材料一致', 'CASE-APPROVED',
    'review-approve-' || suffix, 'hash-review-approve-' || suffix,
    'contract-review-approve', 'contract-test', review_evidence
  );
  if review_approved #>> '{afterSale,status}' <> 'approved'
     or (select count(*) from public.after_sale_review_actions action
         where action.after_sale_id = target_after_sale_id) <> 2
  then raise exception 'CONTRACT_AFTER_SALE_APPROVAL_AUDIT_FAILED'; end if;
  update public.after_sales set type='return_refund' where id=target_after_sale_id;
  begin
    perform public.api_request_refund_authorized('user-test-owner',target_after_sale_id,1000,
      'refund-return-'||suffix,'hash-refund-return-'||suffix,'contract-refund-return','contract-test',
      'membership-test-owner-admin',refund_evidence);
    raise exception 'CONTRACT_UNRECEIVED_RETURN_REFUNDED';
  exception when others then get stacked diagnostics error_message=message_text;
    if error_message not like '%AFTER_SALE_NOT_REFUNDABLE%' then raise; end if;
  end;
  if (select status from public.after_sales where id=target_after_sale_id)<>'approved'
     or exists(select 1 from public.refunds refund where refund.order_id=after_sale_contract.order_id)
  then raise exception 'CONTRACT_RETURN_REFUND_MUTATED_MONEY_STATE'; end if;
  update public.after_sales set type='refund_only' where id=target_after_sale_id;
  perform public.api_review_after_sale_authorized(
    'membership-test-owner-admin', 'user-test-owner', rejected_after_sale_id,
    'rejected', '证据不支持本次售后申请', 'CASE-REJECTED',
    'review-reject-' || suffix, 'hash-review-reject-' || suffix,
    'contract-review-reject', 'contract-test', review_evidence
  );
  if (select status from public.after_sales where id = rejected_after_sale_id) <> 'rejected'
     or (select status from public.orders where id = order_id) <> 'paid'
     or (select count(*) from public.after_sale_review_actions action
         where action.after_sale_id = rejected_after_sale_id and action.status_after = 'rejected') <> 1
  then raise exception 'CONTRACT_AFTER_SALE_REJECTION_FAILED'; end if;
  update public.orders set status = 'refund_pending' where id = order_id;
  update public.orders set status = 'paid' where id = order_id;
  begin
    perform public.api_review_after_sale_authorized(
      'membership-test-owner-admin', 'user-test-owner', conflict_after_sale_id,
      'rejected', '订单已推进不得用旧快照覆盖', 'CASE-ORDER-CONFLICT',
      'review-conflict-' || suffix, 'hash-review-conflict-' || suffix,
      'contract-review-conflict', 'contract-test', review_evidence
    );
    raise exception 'CONTRACT_AFTER_SALE_ORDER_STATE_OVERWRITTEN';
  exception when others then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%AFTER_SALE_ORDER_STATE_CONFLICT%' then raise; end if;
  end;
  if (select status from public.orders where id = order_id) <> 'paid'
  then raise exception 'CONTRACT_AFTER_SALE_ORDER_STATE_CHANGED'; end if;
  update public.orders set status = 'refund_pending' where id = order_id;
  begin
    perform public.api_request_refund_authorized('user-test-owner',target_after_sale_id,null,
      'refund-null-'||suffix,'hash-refund-null-'||suffix,'contract-refund-null','contract-test',
      'membership-test-owner-admin',refund_evidence);
    raise exception 'CONTRACT_NULL_REFUND_ALLOWED';
  exception when others then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%REFUND_AMOUNT_INVALID%' then raise; end if;
  end;
  if (select status from public.after_sales where id=target_after_sale_id)<>'approved'
     or exists(select 1 from public.refunds refund where refund.order_id=after_sale_contract.order_id)
  then raise exception 'CONTRACT_NULL_REFUND_MUTATED_MONEY_STATE'; end if;
  begin
    perform public.api_request_refund_authorized(
      'user-test-owner', blocked_after_sale_id, 1000,
      'refund-blocked-' || suffix, 'hash-refund-blocked-' || suffix,
      'contract-refund-blocked', 'contract-test', 'membership-test-owner-admin',
      refund_evidence || jsonb_build_object('stepUpAt', null)
    );
    raise exception 'CONTRACT_REFUND_NULL_STEP_UP_ALLOWED';
  exception when others then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%REFUND_OPERATOR_NOT_AUTHORIZED%' then raise; end if;
  end;
  begin
    perform public.api_request_refund_authorized(
      'user-test-owner', blocked_after_sale_id, 1000,
      'refund-blocked-' || suffix, 'hash-refund-blocked-' || suffix,
      'contract-refund-blocked', 'contract-test', 'membership-test-owner-admin',
      refund_evidence
    );
    raise exception 'CONTRACT_UNAPPROVED_REFUND_ALLOWED';
  exception when others then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%AFTER_SALE_NOT_APPROVED%' then raise; end if;
  end;
  replay_response := jsonb_set(replay_response, '{refund,afterSaleId}', to_jsonb(target_after_sale_id));
  insert into public.idempotency_keys (
    tenant_id, mall_id, scope, idempotency_key, request_hash, resource_id,
    response_json, created_at, expires_at
  ) values (
    'tenant-smart-wing', 'mall-demo', 'refund:request',
    'refund-replay-' || suffix, 'hash-refund-replay-' || suffix,
    target_after_sale_id, replay_response, now(), now() + interval '24 hours'
  );
  update public.after_sales set status = 'completed' where id = target_after_sale_id;
  if public.api_request_refund_authorized(
    'user-test-owner', target_after_sale_id, 1000,
    'refund-replay-' || suffix, 'hash-refund-replay-' || suffix,
    'contract-refund-replay', 'contract-test', 'membership-test-owner-admin',
    refund_evidence
  ) <> replay_response then
    raise exception 'CONTRACT_REFUND_IDEMPOTENCY_REPLAY_FAILED';
  end if;

  if to_regprocedure(
       'public.api_execute_internal_refund_unchecked(text,text,text,text,text,bigint,text,text,text,text)'
     ) is not null
     or to_regprocedure(
       'public.api_execute_internal_refund(text,text,text,text,text,bigint,text,text,text,text)'
     ) is not null
     or to_regprocedure(
       'public.api_execute_internal_refund_authorized(text,text,bigint,text,text,text,text,text,jsonb)'
     ) is not null
     or has_function_privilege(
       'service_role',
       'public.api_create_after_sale(text,text,text,text,text,text,text,bigint,text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.api_request_refund_authorized(text,text,bigint,text,text,text,text,text,jsonb)',
       'EXECUTE'
     )
  then raise exception 'CONTRACT_AFTER_SALE_FUNCTION_ACL_INVALID'; end if;
end after_sale_contract;
$$;
rollback;
