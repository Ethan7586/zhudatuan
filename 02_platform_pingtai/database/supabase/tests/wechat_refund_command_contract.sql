begin;

do $$
<<wechat_refund_command_contract>>
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  owner_session uuid:=gen_random_uuid(); owner_factor text:='refund-command-factor-'||suffix;
  verified_at timestamptz:=clock_timestamp(); owner_authz integer; owner_credential integer;
  evidence jsonb; order_id text:='refund-command-order-'||suffix;
  payment_id text:='refund-command-payment-'||suffix; after_sale_id text:='refund-command-as-'||suffix;
  identity_id uuid:=gen_random_uuid(); attempt_id uuid:=gen_random_uuid();
  capture_event uuid:=gen_random_uuid(); capture_inbox uuid; capture_effect uuid:=gen_random_uuid();
  capture_journal uuid; command_id uuid; provider_refund_id text:='500000COMMAND'||upper(suffix);
  claim record; result jsonb;
begin
  insert into public.role_permissions(role_id,permission_id)
  select 'role-platform-owner-v2',id from public.permissions where code='order.refund'
  on conflict do nothing;
  select membership.authz_version,coalesce(credential.credential_version,0)
  into strict owner_authz,owner_credential from public.memberships membership
  left join public.member_credentials credential on credential.member_id=membership.member_id
  where membership.id='membership-test-owner-admin';
  insert into public.auth_sessions(
    id,member_id,membership_id,target,credential_version,ip_hash,
    user_agent,device_label,expires_at
  ) values(
    owner_session,'member-test-owner','membership-test-owner-admin','admin',
    owner_credential,'refund-command','refund-command','refund-command',now()+interval '1 hour'
  );
  insert into public.admin_mfa_factors(
    id,tenant_id,user_id,factor_type,secret_ciphertext,label,status
  ) values(
    owner_factor,'tenant-smart-wing','user-test-owner','totp',repeat('a',32),
    'Refund command contract','active'
  ) on conflict(user_id,factor_type) do update set status='active' returning id into owner_factor;
  insert into public.admin_step_up_challenges(
    id,membership_id,user_id,session_id,factor_id,status,attempts,
    request_id,created_at,expires_at,verified_at,updated_at
  ) values(
    'refund-command-stepup-'||suffix,'membership-test-owner-admin','user-test-owner',
    owner_session::text,owner_factor,'verified',0,'refund-command-stepup-'||suffix,
    verified_at,verified_at+interval '5 minutes',verified_at,verified_at
  );
  evidence:=jsonb_build_object(
    'sessionId',owner_session,'membershipId','membership-test-owner-admin',
    'authzVersion',owner_authz,'permission','order.refund','stepUpAt',verified_at
  );

  insert into public.orders(
    id,order_no,tenant_id,enterprise_id,mall_id,user_id,status,
    goods_amount_cents,discount_cents,payable_cents,paid_cents,
    recipient_snapshot_json,paid_at
  ) values(
    order_id,'REFUND-COMMAND-'||suffix,'tenant-smart-wing','enterprise-demo',
    'mall-demo','user-test-storefront','refund_pending',1000,0,1000,1000,'{}',now()
  );
  insert into public.payments(
    id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,
    amount_cents,provider_trade_no,idempotency_key,completed_at
  ) values(
    payment_id,'REFUND-COMMAND-PAY-'||suffix,'tenant-smart-wing','mall-demo',
    'user-test-storefront',order_id,'wechat','succeeded',1000,
    '420000COMMAND'||upper(suffix),'refund-command-payment-'||suffix,now()
  );
  insert into public.member_wechat_identities(id,app_id,open_id)
  values(identity_id,'wxcommand'||suffix,'openid-command-'||suffix);
  insert into public.wechat_payment_attempts(
    id,payment_id,order_id,identity_id,created_by_membership_id,app_id,mch_id,
    out_trade_no,description,amount_total,payer_openid_hash,status,
    transaction_id,provider_trade_state,completed_at
  ) values(
    attempt_id,payment_id,order_id,identity_id,'membership-test-storefront',
    'wxcommand'||suffix,'190000contract','RCM'||upper(suffix),'Refund command contract',
    1000,repeat('1',64),'succeeded','420000COMMAND'||upper(suffix),'SUCCESS',now()
  );
  insert into public.after_sales(
    id,after_sale_no,tenant_id,mall_id,user_id,order_id,type,status,reason,
    requested_amount_cents,requested_by_membership_id,requested_by_member_id,
    order_status_before_request,migration_status
  ) values(
    after_sale_id,'REFUND-COMMAND-AS-'||suffix,'tenant-smart-wing','mall-demo',
    'user-test-storefront',order_id,'refund_only','approved','微信退款指令状态机',
    1000,'membership-test-storefront','member-test-storefront','paid','ready'
  );
  insert into public.payment_outbox(
    id,event_key,source,topic,order_id,payment_id,payment_intent_id,
    attempt_id,payload_json,status,delivered_at
  ) values(
    capture_event,'refund-command-capture:'||suffix,'wechat','order.payment_succeeded',
    order_id,payment_id,null,attempt_id,jsonb_build_object('orderId',order_id),'delivered',now()
  );
  insert into public.payment_event_inbox(
    outbox_id,event_key,tenant_id,aggregate_id,aggregate_version,
    event_type,payload_digest,consumer
  ) select id,event_key,tenant_id,aggregate_id,aggregate_version,event_type,
    encode(digest(event_key,'sha256'),'hex'),'refund-command-contract'
  from public.payment_outbox where id=capture_event returning id into capture_inbox;
  insert into public.payment_event_effects(
    id,inbox_id,outbox_id,tenant_id,order_id,payment_id,payment_intent_id,
    effect_type,status,payload_json,completed_at
  ) values(
    capture_effect,capture_inbox,capture_event,'tenant-smart-wing',order_id,payment_id,
    null,'accounting','succeeded','{"contract":true}',now()
  );
  insert into public.finance_journals(
    tenant_id,mall_id,order_id,payment_id,payment_intent_id,source_effect_id,
    refund_id,journal_type,business_reference,currency,amount_cents,status,occurred_at
  ) values(
    'tenant-smart-wing','mall-demo',order_id,payment_id,null,capture_effect,null,
    'payment_capture','payment:'||payment_id,'CNY',1000,'posted',now()
  ) returning id into capture_journal;
  insert into public.finance_journal_entries(
    journal_id,tenant_id,mall_id,order_id,payment_id,payment_intent_id,
    account_code,side,amount_cents,subject_type,subject_id
  ) values
    (capture_journal,'tenant-smart-wing','mall-demo',order_id,payment_id,null,
      'asset:wechat_receivable','debit',1000,'order',order_id),
    (capture_journal,'tenant-smart-wing','mall-demo',order_id,payment_id,null,
      'liability:customer_payment_clearing','credit',1000,'order',order_id);
  set constraints all immediate; set constraints all deferred;

  perform public.api_request_refund_authorized(
    'user-test-owner',after_sale_id,1000,'refund-command-'||suffix,
    'refund-command-hash-'||suffix,'refund-command-request','contract',
    'membership-test-owner-admin',evidence
  );
  select command.id into strict command_id from public.wechat_refund_commands command
  where command.after_sale_id=wechat_refund_command_contract.after_sale_id;

  select * into strict claim from public.api_claim_wechat_refund_commands('refund-command-worker',1,30);
  if claim.id<>command_id or claim.operation<>'apply'
  then raise exception 'CONTRACT_REFUND_INITIAL_APPLY_NOT_CLAIMED'; end if;
  result:=public.api_record_wechat_refund_result(
    claim.id,claim.provider_attempt_id,'refund-command-worker',claim.lease_token,
    'PROCESSING',provider_refund_id,'apply-processing-'||suffix,
    claim.out_refund_no,claim.out_trade_no,claim.transaction_id,
    claim.amount_cents,claim.payment_total_cents,claim.currency
  );
  if result->>'status'<>'requested'
     or (select next_operation from public.wechat_refund_commands where id=command_id)<>'query'
     or exists(select 1 from public.wechat_refund_event_outbox event
       where event.command_id=wechat_refund_command_contract.command_id)
  then raise exception 'CONTRACT_REFUND_APPLY_ACCEPTANCE_TREATED_AS_TERMINAL'; end if;

  update public.wechat_refund_commands set available_at=now() where id=command_id;
  select * into strict claim from public.api_claim_wechat_refund_commands('refund-command-worker',1,30);
  result:=public.api_record_wechat_refund_result(
    claim.id,claim.provider_attempt_id,'refund-command-worker',claim.lease_token,
    'ABNORMAL',provider_refund_id,'query-abnormal-'||suffix,
    claim.out_refund_no,claim.out_trade_no,claim.transaction_id,
    claim.amount_cents,claim.payment_total_cents,claim.currency
  );
  if claim.operation<>'query' or result->>'status'<>'requested'
     or exists(select 1 from public.wechat_refund_event_outbox event
       where event.command_id=wechat_refund_command_contract.command_id)
  then raise exception 'CONTRACT_REFUND_ABNORMAL_TREATED_AS_TERMINAL'; end if;

  update public.wechat_refund_commands set available_at=now() where id=command_id;
  select * into strict claim from public.api_claim_wechat_refund_commands('refund-command-worker',1,30);
  result:=public.api_fail_wechat_refund_attempt(
    claim.id,claim.provider_attempt_id,'refund-command-worker',claim.lease_token,
    'gateway_timeout',true
  );
  if result->>'status'<>'requested' or result->>'errorCode'<>'GATEWAY_TIMEOUT'
     or (select error_code from public.wechat_refund_provider_attempts where id=claim.provider_attempt_id)<>'GATEWAY_TIMEOUT'
  then raise exception 'CONTRACT_REFUND_RETRYABLE_FAILURE_NOT_PERSISTED'; end if;

  update public.wechat_refund_commands set available_at=now() where id=command_id;
  select * into strict claim from public.api_claim_wechat_refund_commands('refund-command-worker',1,30);
  perform public.api_fail_wechat_refund_attempt(
    claim.id,claim.provider_attempt_id,'refund-command-worker',claim.lease_token,
    'WECHAT_PAY_PROVIDER_RESOURCE_NOT_EXISTS',true
  );
  if claim.operation<>'query'
     or (select next_operation from public.wechat_refund_commands where id=command_id)<>'apply'
  then raise exception 'CONTRACT_REFUND_NOT_FOUND_DID_NOT_RETRY_STABLE_APPLY'; end if;

  update public.wechat_refund_commands set available_at=now() where id=command_id;
  select * into strict claim from public.api_claim_wechat_refund_commands('refund-command-worker',1,30);
  result:=public.api_record_wechat_refund_result(
    claim.id,claim.provider_attempt_id,'refund-command-worker',claim.lease_token,
    'SUCCESS',provider_refund_id,'apply-success-'||suffix,
    claim.out_refund_no,claim.out_trade_no,claim.transaction_id,
    claim.amount_cents,claim.payment_total_cents,claim.currency
  );
  if claim.operation<>'apply' or result->>'status'<>'requested'
     or exists(select 1 from public.wechat_refund_event_outbox event
       where event.command_id=wechat_refund_command_contract.command_id)
  then raise exception 'CONTRACT_REFUND_APPLY_SUCCESS_BYPASSED_QUERY'; end if;

  update public.wechat_refund_commands set available_at=now() where id=command_id;
  select * into strict claim from public.api_claim_wechat_refund_commands('refund-command-worker',1,30);
  perform public.api_record_wechat_refund_result(
    claim.id,claim.provider_attempt_id,'refund-command-worker',claim.lease_token,
    'SUCCESS',provider_refund_id,'query-success-'||suffix,
    claim.out_refund_no,claim.out_trade_no,claim.transaction_id,
    claim.amount_cents,claim.payment_total_cents,claim.currency
  );
  if not exists(select 1 from public.wechat_refund_event_outbox event
    where event.command_id=wechat_refund_command_contract.command_id
      and event.event_type='RefundSucceeded')
  then raise exception 'CONTRACT_REFUND_QUERY_SUCCESS_EVENT_MISSING'; end if;
end wechat_refund_command_contract;
$$;

rollback;
