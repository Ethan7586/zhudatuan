begin;

do $$
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  session_id uuid:=gen_random_uuid(); challenge_id text:='contract-recovery-'||suffix;
  factor_id text:='contract-recovery-factor-'||suffix;
  authz_version integer; credential_version integer; verified_at timestamptz:=now();
  read_evidence jsonb; manage_evidence jsonb; response jsonb; error_message text;
  recovery_order_id text:='contract-recovery-order-'||suffix;
  recovery_payment_id text:='contract-recovery-payment-'||suffix;
  query_order text:='contract-recovery-query-order-'||suffix;
  query_payment text:='contract-recovery-query-payment-'||suffix;
  identity_id uuid:=gen_random_uuid(); recovery_attempt_id uuid:=gen_random_uuid();
  query_attempt uuid:=gen_random_uuid(); recovery_event_id uuid:=gen_random_uuid();
  accounting_id uuid; fulfillment_id uuid; claim record; execute_result jsonb;
  payload_before jsonb; inbox_before uuid; outbox_before uuid;
begin
  update public.payment_event_effects set status='dead_letter',
    dead_lettered_at=now(),locked_by=null,locked_at=null,lease_token=null,
    lease_expires_at=null where status in('pending','processing');
  update public.payment_outbox set status='dead_letter',
    dead_lettered_at=now(),locked_by=null,locked_at=null,lease_token=null,
    lease_expires_at=null where status in('pending','processing');
  select membership.authz_version,credential.credential_version
  into strict authz_version,credential_version
  from public.memberships membership left join public.member_credentials credential
    on credential.member_id=membership.member_id
  where membership.id='membership-test-owner-admin';
  insert into public.auth_sessions(id,member_id,membership_id,target,
    credential_version,ip_hash,user_agent,device_label,expires_at)
  values(session_id,'member-test-owner','membership-test-owner-admin','admin',
    credential_version,'contract-recovery','contract','contract',
    now()+interval '1 hour');
  insert into public.admin_mfa_factors(id,tenant_id,user_id,factor_type,
    secret_ciphertext,label,status)
  values(factor_id,'tenant-smart-wing','user-test-owner','totp',
    repeat('a',32),'Contract recovery','active')
  on conflict(user_id,factor_type) do update set status='active'
  returning id into factor_id;
  insert into public.admin_step_up_challenges(id,membership_id,user_id,
    session_id,factor_id,status,attempts,request_id,created_at,expires_at,
    verified_at,updated_at)
  values(challenge_id,'membership-test-owner-admin','user-test-owner',
    session_id::text,factor_id,'verified',0,'contract-recovery-stepup-'||suffix,
    verified_at,verified_at+interval '5 minutes',verified_at,verified_at);
  read_evidence:=jsonb_build_object('sessionId',session_id,
    'membershipId','membership-test-owner-admin','authzVersion',authz_version,
    'permission','payment.outbox.read');
  manage_evidence:=read_evidence||jsonb_build_object(
    'permission','payment.outbox.manage','stepUpAt',verified_at);

  insert into public.orders(id,order_no,tenant_id,enterprise_id,mall_id,user_id,
    status,goods_amount_cents,discount_cents,payable_cents,paid_cents,
    recipient_snapshot_json,paid_at)
  values(recovery_order_id,'CONTRACT-RECOVERY-'||suffix,'tenant-smart-wing',
    'enterprise-demo','mall-demo','user-test-storefront','paid',100,0,100,100,
    '{}',now());
  insert into public.payments(id,payment_no,tenant_id,mall_id,user_id,order_id,
    channel,status,amount_cents,provider_trade_no,idempotency_key,completed_at)
  values(recovery_payment_id,'CONTRACT-RECOVERY-PAY-'||suffix,'tenant-smart-wing',
    'mall-demo','user-test-storefront',recovery_order_id,'wechat','succeeded',100,
    'CONTRACT-RECOVERY-TX-'||suffix,'contract-recovery-pay-'||suffix,now());
  insert into public.member_wechat_identities(id,app_id,open_id)
  values(identity_id,'wxrecover'||suffix,'openid-recovery-'||suffix);
  insert into public.wechat_payment_attempts(id,payment_id,order_id,identity_id,
    created_by_membership_id,app_id,mch_id,out_trade_no,description,
    amount_total,payer_openid_hash,status,transaction_id,
    provider_trade_state,completed_at)
  values(recovery_attempt_id,recovery_payment_id,recovery_order_id,identity_id,
    'membership-test-storefront','wxrecover'||suffix,'mchrecover'||suffix,
    'RECOVER'||upper(suffix),'Contract recovery',100,repeat('a',64),
    'succeeded','CONTRACT-RECOVERY-TX-'||suffix,'SUCCESS',now());
  insert into public.wechat_payment_observations(provider_event_key,source,
    provider_event_id,event_type,resource_type,attempt_id,app_id,mch_id,
    out_trade_no,transaction_id,trade_state,success_time,amount_total,
    payer_openid_hash,evidence_json,evidence_digest,request_id,outcome)
  values('contract-recovery-observation-'||suffix,'query','recovery-'||suffix,
    'QUERY.TRANSACTION','transaction',recovery_attempt_id,'wxrecover'||suffix,
    'mchrecover'||suffix,'RECOVER'||upper(suffix),
    'CONTRACT-RECOVERY-TX-'||suffix,'SUCCESS',now(),100,repeat('a',64),
    '{}',repeat('b',64),'contract-recovery-observation-'||suffix,'applied');
  insert into public.payment_outbox(id,event_key,topic,order_id,payment_id,
    attempt_id,payload_json)
  values(recovery_event_id,'contract-recovery-observation-'||suffix||
    ':order.payment_succeeded','order.payment_succeeded',recovery_order_id,
    recovery_payment_id,recovery_attempt_id,
    jsonb_build_object('orderId',recovery_order_id,
      'paymentId',recovery_payment_id,'attemptId',recovery_attempt_id,
      'amountCents',100,'tradeState','SUCCESS',
      'outcome','applied','transactionId','CONTRACT-RECOVERY-TX-'||suffix));
  select * into strict claim from public.api_claim_payment_outbox(
    'wechat','contract-recovery-relay',1,30);
  perform public.api_start_payment_effects(
    'wechat',recovery_event_id,'contract-recovery-relay',claim.lease_token);
  perform public.api_finish_payment_outbox(
    'wechat',recovery_event_id,'contract-recovery-relay',claim.lease_token,true,null);
  select id into strict accounting_id from public.payment_event_effects
    where outbox_id=recovery_event_id and effect_type='accounting';
  select id into strict fulfillment_id from public.payment_event_effects
    where outbox_id=recovery_event_id and effect_type='fulfillment';
  select payload_json,inbox_id,outbox_id into payload_before,inbox_before,outbox_before
    from public.payment_event_effects where id=accounting_id;
  update public.payments set status='processing' where id=recovery_payment_id;
  update public.payment_event_effects set attempts=11 where id=accounting_id;
  select * into strict claim from public.api_claim_payment_event_effects(
    'contract-recovery-effect',1,30);
  execute_result:=public.api_execute_payment_event_effect(
    claim.id,'contract-recovery-effect',claim.lease_token);
  if claim.id<>accounting_id or execute_result->>'status'<>'dead_letter'
    or not exists(select 1 from public.payment_operations_alerts
      where resource_type='payment_effect' and resource_id=accounting_id::text
        and status='open' and severity='critical')
    or exists(select 1 from public.api_claim_payment_event_effects(
      'contract-recovery-blocked',1,30))
  then raise exception 'CONTRACT_RECOVERY_EFFECT_DEADLETTER_INVALID'; end if;
  begin
    perform public.api_replay_payment_operation_deadletter(
      'payment_effect',accounting_id::text,'membership-test-owner-admin',
      'user-test-owner','tenant-smart-wing','enterprise-demo','mall-demo',
      manage_evidence-'stepUpAt','修复会计依赖后重放',
      'contract-recovery-no-stepup-'||suffix);
    raise exception 'CONTRACT_RECOVERY_NO_STEPUP_ALLOWED';
  exception when others then get stacked diagnostics error_message=message_text;
    if error_message not like '%PAYMENT_OUTBOX_NOT_AUTHORIZED%' then raise; end if;
  end;
  update public.payments set status='succeeded' where id=recovery_payment_id;
  response:=public.api_replay_payment_operation_deadletter(
    'payment_effect',accounting_id::text,'membership-test-owner-admin',
    'user-test-owner','tenant-smart-wing','enterprise-demo','mall-demo',
    manage_evidence,'修复会计依赖后重放','contract-recovery-effect-'||suffix);
  if response->>'status'<>'replayed'
    or(select row(payload_json,inbox_id,outbox_id) is distinct from
      row(payload_before,inbox_before,outbox_before)
      from public.payment_event_effects where id=accounting_id)
    or(select status from public.payment_operations_alerts
      where resource_type='payment_effect'
        and resource_id=accounting_id::text)<>'resolved'
  then raise exception 'CONTRACT_RECOVERY_EFFECT_IDENTITY_CHANGED'; end if;
  response:=public.api_replay_payment_operation_deadletter(
    'payment_effect',accounting_id::text,'membership-test-owner-admin',
    'user-test-owner','tenant-smart-wing','enterprise-demo','mall-demo',
    manage_evidence,'修复会计依赖后重放','contract-recovery-effect-'||suffix);
  if response->>'duplicate'<>'true' then
    raise exception 'CONTRACT_RECOVERY_REPLAY_NOT_IDEMPOTENT'; end if;
  select * into strict claim from public.api_claim_payment_event_effects(
    'contract-recovery-effect',1,30);
  execute_result:=public.api_execute_payment_event_effect(
    claim.id,'contract-recovery-effect',claim.lease_token);
  if claim.id<>accounting_id or execute_result->>'status'<>'succeeded'
    or(select count(*) from public.finance_journals journal
      where journal.payment_id=recovery_payment_id
        and journal.journal_type='payment_capture')<>1
  then raise exception 'CONTRACT_RECOVERY_ACCOUNTING_REPLAY_FAILED'; end if;
  perform public.process_payment_accounting_effect(accounting_id);
  if(select count(*) from public.finance_journals journal
      where journal.payment_id=recovery_payment_id
        and journal.journal_type='payment_capture')<>1
  then raise exception 'CONTRACT_RECOVERY_ACCOUNTING_DUPLICATED'; end if;
  select * into strict claim from public.api_claim_payment_event_effects(
    'contract-recovery-next',1,30);
  if claim.id<>fulfillment_id then
    raise exception 'CONTRACT_RECOVERY_SUCCESSOR_NOT_RELEASED'; end if;

  insert into public.orders(id,order_no,tenant_id,enterprise_id,mall_id,user_id,
    status,goods_amount_cents,discount_cents,payable_cents,paid_cents,
    recipient_snapshot_json)
  values(query_order,'CONTRACT-RECOVERY-QUERY-'||suffix,'tenant-smart-wing',
    'enterprise-demo','mall-demo','user-test-storefront','pending_payment',
    100,0,100,0,'{}');
  insert into public.payments(id,payment_no,tenant_id,mall_id,user_id,order_id,
    channel,status,amount_cents,idempotency_key)
  values(query_payment,'CONTRACT-RECOVERY-QUERYPAY-'||suffix,
    'tenant-smart-wing','mall-demo','user-test-storefront',query_order,
    'wechat','processing',100,'contract-recovery-query-'||suffix);
  insert into public.wechat_payment_attempts(id,payment_id,order_id,identity_id,
    created_by_membership_id,app_id,mch_id,out_trade_no,description,
    amount_total,payer_openid_hash,status)
  values(query_attempt,query_payment,query_order,identity_id,
    'membership-test-storefront','wxrecover'||suffix,'mchrecover'||suffix,
    'RECOVERQ'||upper(suffix),'Contract query recovery',100,repeat('a',64),
    'processing');
  update public.wechat_payment_attempts set query_attempts=12,
    query_last_error_code='NETWORK_EXHAUSTED',query_dead_lettered_at=now()
    where id=query_attempt;
  if not exists(select 1 from public.payment_operations_alerts
    where resource_type='payment_query' and resource_id=query_attempt::text
      and status='open')
  then raise exception 'CONTRACT_RECOVERY_QUERY_ALERT_MISSING'; end if;
  response:=public.api_replay_payment_operation_deadletter(
    'payment_query',query_attempt::text,'membership-test-owner-admin',
    'user-test-owner','tenant-smart-wing','enterprise-demo','mall-demo',
    manage_evidence,'网络恢复后重新查单','contract-recovery-query-'||suffix);
  if response->>'status'<>'replayed'
    or(select query_dead_lettered_at is not null or query_attempts<>0
      from public.wechat_payment_attempts where id=query_attempt)
    or(select status from public.orders where id=query_order)<>'pending_payment'
    or(select status from public.payments where id=query_payment)<>'processing'
    or exists(select 1 from public.api_payment_operation_deadletters(
      'membership-test-owner-admin','user-test-owner','tenant-smart-wing',
      'enterprise-demo','mall-demo',read_evidence,50) alert
      where alert.resource_id=accounting_id::text)
  then raise exception 'CONTRACT_RECOVERY_QUERY_REPLAY_INVALID'; end if;
  if to_regprocedure(
      'public.api_ignore_payment_operation_deadletter(text,text,text,text,text,text,text,jsonb,text,text)')
      is not null
    or has_function_privilege('authenticated',
      'public.api_replay_payment_operation_deadletter(text,text,text,text,text,text,text,jsonb,text,text)','execute')
    or has_table_privilege('service_role','public.payment_operations_alerts','select')
    or(select risk_level from public.permissions
      where code='payment.outbox.manage')<>'critical'
  then raise exception 'CONTRACT_RECOVERY_ACL_INVALID'; end if;
end $$;

rollback;
