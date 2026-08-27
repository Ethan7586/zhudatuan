begin;

do $$
<<wechat_refund_event_contract>>
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  owner_session uuid:=gen_random_uuid(); owner_factor text:='refund-event-factor-'||suffix;
  verified_at timestamptz:=clock_timestamp(); owner_authz integer; owner_credential integer;
  evidence jsonb; order_id text:='refund-event-order-'||suffix;
  payment_id text:='refund-event-payment-'||suffix; after_sale_id text:='refund-event-as-'||suffix;
  refund_id text:='refund-event-refund-'||suffix; provider_refund_id text:='500000EVENT'||upper(suffix);
  identity_id uuid:=gen_random_uuid(); attempt_id uuid:=gen_random_uuid(); command_id uuid:=gen_random_uuid();
  capture_event uuid:=gen_random_uuid(); capture_inbox uuid; capture_effect uuid:=gen_random_uuid();
  capture_journal uuid; event_id uuid:=gen_random_uuid(); claim record;
  old_token uuid; new_token uuid; result jsonb; replay_result jsonb; duplicate_result jsonb;
  error_message text; debit bigint; credit bigint;
begin
  insert into public.role_permissions(role_id,permission_id)
  select 'role-platform-owner-v2',id from public.permissions
  where code='payment.outbox.manage' on conflict do nothing;
  select membership.authz_version,coalesce(credential.credential_version,0)
  into strict owner_authz,owner_credential from public.memberships membership
  left join public.member_credentials credential on credential.member_id=membership.member_id
  where membership.id='membership-test-owner-admin';
  insert into public.auth_sessions(
    id,member_id,membership_id,target,credential_version,ip_hash,
    user_agent,device_label,expires_at
  ) values(
    owner_session,'member-test-owner','membership-test-owner-admin','admin',
    owner_credential,'refund-event','refund-event','refund-event',now()+interval '1 hour'
  );
  insert into public.admin_mfa_factors(
    id,tenant_id,user_id,factor_type,secret_ciphertext,label,status
  ) values(
    owner_factor,'tenant-smart-wing','user-test-owner','totp',repeat('a',32),
    'Refund event contract','active'
  ) on conflict(user_id,factor_type) do update set status='active' returning id into owner_factor;
  insert into public.admin_step_up_challenges(
    id,membership_id,user_id,session_id,factor_id,status,attempts,
    request_id,created_at,expires_at,verified_at,updated_at
  ) values(
    'refund-event-stepup-'||suffix,'membership-test-owner-admin','user-test-owner',
    owner_session::text,owner_factor,'verified',0,'refund-event-stepup-'||suffix,
    verified_at,verified_at+interval '5 minutes',verified_at,verified_at
  );
  evidence:=jsonb_build_object(
    'sessionId',owner_session,'membershipId','membership-test-owner-admin',
    'authzVersion',owner_authz,'permission','payment.outbox.manage','stepUpAt',verified_at
  );

  insert into public.orders(
    id,order_no,tenant_id,enterprise_id,mall_id,user_id,status,
    goods_amount_cents,discount_cents,payable_cents,paid_cents,
    recipient_snapshot_json,paid_at
  ) values(
    order_id,'REFUND-EVENT-'||suffix,'tenant-smart-wing','enterprise-demo',
    'mall-demo','user-test-storefront','refund_pending',1000,0,1000,1000,'{}',now()
  );
  insert into public.payments(
    id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,
    amount_cents,provider_trade_no,idempotency_key,completed_at
  ) values(
    payment_id,'REFUND-EVENT-PAY-'||suffix,'tenant-smart-wing','mall-demo',
    'user-test-storefront',order_id,'wechat','succeeded',1000,
    '420000EVENT'||upper(suffix),'refund-event-payment-'||suffix,now()
  );
  insert into public.member_wechat_identities(id,app_id,open_id)
  values(identity_id,'wxevent'||suffix,'openid-event-'||suffix);
  insert into public.wechat_payment_attempts(
    id,payment_id,order_id,identity_id,created_by_membership_id,app_id,mch_id,
    out_trade_no,description,amount_total,payer_openid_hash,status,
    transaction_id,provider_trade_state,completed_at
  ) values(
    attempt_id,payment_id,order_id,identity_id,'membership-test-storefront',
    'wxevent'||suffix,'190000contract','REV'||upper(suffix),'Refund event contract',
    1000,repeat('2',64),'succeeded','420000EVENT'||upper(suffix),'SUCCESS',now()
  );
  insert into public.after_sales(
    id,after_sale_no,tenant_id,mall_id,user_id,order_id,type,status,reason,
    requested_amount_cents,requested_by_membership_id,requested_by_member_id,
    order_status_before_request,migration_status
  ) values(
    after_sale_id,'REFUND-EVENT-AS-'||suffix,'tenant-smart-wing','mall-demo',
    'user-test-storefront',order_id,'refund_only','approved','微信退款事件闭环',
    1000,'membership-test-storefront','member-test-storefront','paid','ready'
  );
  insert into public.payment_outbox(
    id,event_key,source,topic,order_id,payment_id,payment_intent_id,
    attempt_id,payload_json,status,delivered_at
  ) values(
    capture_event,'refund-event-capture:'||suffix,'wechat','order.payment_succeeded',
    order_id,payment_id,null,attempt_id,jsonb_build_object('orderId',order_id),'delivered',now()
  );
  insert into public.payment_event_inbox(
    outbox_id,event_key,tenant_id,aggregate_id,aggregate_version,
    event_type,payload_digest,consumer
  ) select id,event_key,tenant_id,aggregate_id,aggregate_version,event_type,
    encode(digest(event_key,'sha256'),'hex'),'refund-event-contract'
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
  insert into public.refunds(
    id,refund_no,tenant_id,mall_id,order_id,payment_id,amount_cents,status,reason,idempotency_key
  ) values(
    refund_id,'WR'||upper(suffix),'tenant-smart-wing','mall-demo',order_id,payment_id,
    1000,'processing','微信退款事件闭环','refund-event-'||suffix
  );
  insert into public.wechat_refund_commands(
    id,tenant_id,mall_id,after_sale_id,order_id,payment_id,refund_id,payment_attempt_id,
    out_refund_no,out_trade_no,transaction_id,amount_cents,payment_total_cents,reason,
    next_operation,status,provider_status,provider_refund_id,idempotency_key,request_hash
  ) values(
    command_id,'tenant-smart-wing','mall-demo',after_sale_id,order_id,payment_id,refund_id,
    attempt_id,'WR'||upper(suffix),'REV'||upper(suffix),'420000EVENT'||upper(suffix),
    1000,1000,'微信退款事件闭环','query','provider_succeeded','SUCCESS',provider_refund_id,
    'refund-event-'||suffix,'refund-event-hash-'||suffix
  );
  insert into public.wechat_refund_event_outbox(
    id,event_key,command_id,tenant_id,aggregate_id,event_type,payload_json
  ) values(
    event_id,'refund:'||refund_id||':succeeded:v1',command_id,'tenant-smart-wing',
    refund_id,'RefundSucceeded',jsonb_build_object('refundId',refund_id,'orderId',order_id)
  );

  update public.wechat_refund_event_outbox set attempts=12,available_at=now() where id=event_id;
  perform public.api_claim_wechat_refund_events('refund-event-retire',1,30);
  if (select status from public.wechat_refund_event_outbox where id=event_id)<>'dead_letter'
     or not exists(select 1 from public.notification_dispatches notification
       where notification.refund_id=wechat_refund_event_contract.refund_id
         and notification.template_key='refund.effect.deadletter')
     or not exists(select 1 from public.audit_logs
       where resource_id=wechat_refund_event_contract.refund_id and action='refund.wechat.effect_dead_letter')
  then raise exception 'CONTRACT_REFUND_EVENT_DEADLETTER_NOT_ALERTED'; end if;
  begin
    perform public.api_replay_wechat_refund_event_authorized(
      event_id,'membership-test-owner-admin','user-test-owner',evidence-'stepUpAt',
      '本地会计依赖已修复','refund-replay-no-stepup-'||suffix,
      'refund-replay-no-stepup-hash-'||suffix,'refund-replay-no-stepup-request'
    );
    raise exception 'CONTRACT_REFUND_EVENT_REPLAY_WITHOUT_STEPUP_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%WECHAT_REFUND_EVENT_REPLAY_NOT_AUTHORIZED%' then raise; end if;
  end;
  replay_result:=public.api_replay_wechat_refund_event_authorized(
    event_id,'membership-test-owner-admin','user-test-owner',evidence,
    '本地会计依赖已修复','refund-replay-'||suffix,'refund-replay-hash-'||suffix,
    'refund-replay-request-'||suffix
  );
  if replay_result->>'status'<>'pending'
     or not exists(select 1 from public.audit_logs
       where request_id='refund-replay-request-'||suffix
         and action='refund.wechat.effect_replayed' and membership_id='membership-test-owner-admin')
  then raise exception 'CONTRACT_REFUND_EVENT_REPLAY_EVIDENCE_INVALID'; end if;

  select * into strict claim from public.api_claim_wechat_refund_events('refund-event-old',1,15);
  old_token:=claim.lease_token;
  update public.wechat_refund_event_outbox set lease_expires_at=now()-interval '1 second'
  where id=event_id;
  select * into strict claim from public.api_claim_wechat_refund_events('refund-event-new',1,30);
  new_token:=claim.lease_token;
  result:=public.api_execute_wechat_refund_event(event_id,'refund-event-old',old_token);
  if result->>'status'<>'lease_lost'
     or (select locked_by from public.wechat_refund_event_outbox where id=event_id)<>'refund-event-new'
     or (select lease_token from public.wechat_refund_event_outbox where id=event_id)<>new_token
  then raise exception 'CONTRACT_REFUND_STALE_EVENT_LEASE_ACKNOWLEDGED'; end if;
  result:=public.api_execute_wechat_refund_event(event_id,'refund-event-new',new_token);
  set constraints all immediate; set constraints all deferred;
  select coalesce(sum(entry.amount_cents) filter(where entry.side='debit'),0),
    coalesce(sum(entry.amount_cents) filter(where entry.side='credit'),0)
  into debit,credit from public.finance_journal_entries entry
  join public.finance_journals journal on journal.id=entry.journal_id
  where journal.refund_id=wechat_refund_event_contract.refund_id;
  if result->>'status'<>'delivered'
     or (select status from public.wechat_refund_commands where id=command_id)<>'succeeded'
     or (select status from public.refunds where id=refund_id)<>'succeeded'
     or (select status from public.after_sales where id=after_sale_id)<>'completed'
     or (select status from public.orders where id=order_id)<>'refunded'
     or (select status from public.payments where id=payment_id)<>'refunded'
     or (select count(*) from public.finance_journals journal
       where journal.refund_id=wechat_refund_event_contract.refund_id)<>1
     or debit<>1000 or credit<>1000 or debit<>credit
     or (select count(*) from public.notification_dispatches notification
       where notification.refund_id=wechat_refund_event_contract.refund_id
         and notification.template_key='refund.succeeded')<>1
  then raise exception 'CONTRACT_REFUND_SUCCESS_EFFECT_INVALID:%',jsonb_build_object(
    'execute',result,'debit',debit,'credit',credit
  ); end if;
  duplicate_result:=public.api_replay_wechat_refund_event_authorized(
    event_id,'membership-test-owner-admin','user-test-owner',evidence,
    '本地会计依赖已修复','refund-replay-'||suffix,'refund-replay-hash-'||suffix,
    'refund-replay-repeat-'||suffix
  );
  if duplicate_result<>replay_result
     or (select count(*) from public.finance_journals journal
       where journal.refund_id=wechat_refund_event_contract.refund_id)<>1
  then raise exception 'CONTRACT_REFUND_REPLAY_NOT_IDEMPOTENT'; end if;
end wechat_refund_event_contract;
$$;

rollback;
