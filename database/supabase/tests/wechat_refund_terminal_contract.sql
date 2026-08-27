begin;

do $$
<<wechat_refund_terminal_contract>>
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  owner_session uuid:=gen_random_uuid(); owner_factor text:='refund-terminal-factor-'||suffix;
  verified_at timestamptz:=clock_timestamp(); owner_authz integer; owner_credential integer;
  evidence jsonb; order_ids text[]:=array['refund-closed-order-'||suffix,'refund-failure-order-'||suffix];
  payment_ids text[]:=array['refund-closed-payment-'||suffix,'refund-failure-payment-'||suffix];
  after_sale_ids text[]:=array['refund-closed-as-'||suffix,'refund-failure-as-'||suffix];
  identity_ids uuid[]:=array[gen_random_uuid(),gen_random_uuid()];
  attempt_ids uuid[]:=array[gen_random_uuid(),gen_random_uuid()];
  capture_event uuid; capture_inbox uuid; capture_effect uuid; capture_journal uuid;
  ordinal integer; claim record; result jsonb; command_id uuid; refund_id text;
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
    owner_credential,'refund-terminal','refund-terminal','refund-terminal',now()+interval '1 hour'
  );
  insert into public.admin_mfa_factors(
    id,tenant_id,user_id,factor_type,secret_ciphertext,label,status
  ) values(
    owner_factor,'tenant-smart-wing','user-test-owner','totp',repeat('a',32),
    'Refund terminal contract','active'
  ) on conflict(user_id,factor_type) do update set status='active' returning id into owner_factor;
  insert into public.admin_step_up_challenges(
    id,membership_id,user_id,session_id,factor_id,status,attempts,
    request_id,created_at,expires_at,verified_at,updated_at
  ) values(
    'refund-terminal-stepup-'||suffix,'membership-test-owner-admin','user-test-owner',
    owner_session::text,owner_factor,'verified',0,'refund-terminal-stepup-'||suffix,
    verified_at,verified_at+interval '5 minutes',verified_at,verified_at
  );
  evidence:=jsonb_build_object(
    'sessionId',owner_session,'membershipId','membership-test-owner-admin',
    'authzVersion',owner_authz,'permission','order.refund','stepUpAt',verified_at
  );

  for ordinal in 1..2 loop
    insert into public.orders(
      id,order_no,tenant_id,enterprise_id,mall_id,user_id,status,
      goods_amount_cents,discount_cents,payable_cents,paid_cents,
      recipient_snapshot_json,paid_at
    ) values(
      order_ids[ordinal],'REFUND-TERMINAL-'||ordinal||'-'||suffix,'tenant-smart-wing',
      'enterprise-demo','mall-demo','user-test-storefront','refund_pending',
      1000,0,1000,1000,'{}',now()
    );
    insert into public.payments(
      id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,
      amount_cents,provider_trade_no,idempotency_key,completed_at
    ) values(
      payment_ids[ordinal],'REFUND-TERMINAL-PAY-'||ordinal||'-'||suffix,
      'tenant-smart-wing','mall-demo','user-test-storefront',order_ids[ordinal],
      'wechat','succeeded',1000,'420000TERMINAL'||ordinal||upper(suffix),
      'refund-terminal-payment-'||ordinal||'-'||suffix,now()
    );
    insert into public.member_wechat_identities(id,app_id,open_id)
    values(identity_ids[ordinal],'wxterminal'||ordinal||suffix,'openid-terminal-'||ordinal||'-'||suffix);
    insert into public.wechat_payment_attempts(
      id,payment_id,order_id,identity_id,created_by_membership_id,app_id,mch_id,
      out_trade_no,description,amount_total,payer_openid_hash,status,
      transaction_id,provider_trade_state,completed_at
    ) values(
      attempt_ids[ordinal],payment_ids[ordinal],order_ids[ordinal],identity_ids[ordinal],
      'membership-test-storefront','wxterminal'||ordinal||suffix,'190000contract',
      'RTE'||ordinal||upper(suffix),'Refund terminal contract',1000,
      repeat((ordinal+3)::text,64),'succeeded','420000TERMINAL'||ordinal||upper(suffix),
      'SUCCESS',now()
    );
    insert into public.after_sales(
      id,after_sale_no,tenant_id,mall_id,user_id,order_id,type,status,reason,
      requested_amount_cents,requested_by_membership_id,requested_by_member_id,
      order_status_before_request,migration_status
    ) values(
      after_sale_ids[ordinal],'REFUND-TERMINAL-AS-'||ordinal||'-'||suffix,
      'tenant-smart-wing','mall-demo','user-test-storefront',order_ids[ordinal],
      'refund_only','approved','微信退款终态契约',1000,'membership-test-storefront',
      'member-test-storefront','paid','ready'
    );
    capture_event:=gen_random_uuid(); capture_effect:=gen_random_uuid();
    insert into public.payment_outbox(
      id,event_key,source,topic,order_id,payment_id,payment_intent_id,
      attempt_id,payload_json,status,delivered_at
    ) values(
      capture_event,'refund-terminal-capture-'||ordinal||':'||suffix,'wechat',
      'order.payment_succeeded',order_ids[ordinal],payment_ids[ordinal],null,attempt_ids[ordinal],
      jsonb_build_object('orderId',order_ids[ordinal]),'delivered',now()
    );
    insert into public.payment_event_inbox(
      outbox_id,event_key,tenant_id,aggregate_id,aggregate_version,
      event_type,payload_digest,consumer
    ) select id,event_key,tenant_id,aggregate_id,aggregate_version,event_type,
      encode(digest(event_key,'sha256'),'hex'),'refund-terminal-contract'
    from public.payment_outbox where id=capture_event returning id into capture_inbox;
    insert into public.payment_event_effects(
      id,inbox_id,outbox_id,tenant_id,order_id,payment_id,payment_intent_id,
      effect_type,status,payload_json,completed_at
    ) values(
      capture_effect,capture_inbox,capture_event,'tenant-smart-wing',order_ids[ordinal],
      payment_ids[ordinal],null,'accounting','succeeded','{"contract":true}',now()
    );
    insert into public.finance_journals(
      tenant_id,mall_id,order_id,payment_id,payment_intent_id,source_effect_id,
      refund_id,journal_type,business_reference,currency,amount_cents,status,occurred_at
    ) values(
      'tenant-smart-wing','mall-demo',order_ids[ordinal],payment_ids[ordinal],null,
      capture_effect,null,'payment_capture','payment:'||payment_ids[ordinal],
      'CNY',1000,'posted',now()
    ) returning id into capture_journal;
    insert into public.finance_journal_entries(
      journal_id,tenant_id,mall_id,order_id,payment_id,payment_intent_id,
      account_code,side,amount_cents,subject_type,subject_id
    ) values
      (capture_journal,'tenant-smart-wing','mall-demo',order_ids[ordinal],payment_ids[ordinal],
        null,'asset:wechat_receivable','debit',1000,'order',order_ids[ordinal]),
      (capture_journal,'tenant-smart-wing','mall-demo',order_ids[ordinal],payment_ids[ordinal],
        null,'liability:customer_payment_clearing','credit',1000,'order',order_ids[ordinal]);
  end loop;
  set constraints all immediate; set constraints all deferred;

  perform public.api_request_refund_authorized(
    'user-test-owner',after_sale_ids[1],1000,'refund-closed-'||suffix,
    'refund-closed-hash-'||suffix,'refund-closed-request','contract',
    'membership-test-owner-admin',evidence
  );
  select command.id,command.refund_id into strict command_id,refund_id
  from public.wechat_refund_commands command where command.after_sale_id=after_sale_ids[1];
  select * into strict claim from public.api_claim_wechat_refund_commands('refund-closed-worker',1,30);
  result:=public.api_record_wechat_refund_result(
    claim.id,claim.provider_attempt_id,'refund-closed-worker',claim.lease_token,
    'CLOSED','500000CLOSED'||upper(suffix),'closed-apply-'||suffix,
    claim.out_refund_no,claim.out_trade_no,claim.transaction_id,
    claim.amount_cents,claim.payment_total_cents,claim.currency
  );
  if result->>'status'<>'requested'
     or exists(select 1 from public.wechat_refund_event_outbox event
       where event.command_id=wechat_refund_terminal_contract.command_id)
  then raise exception 'CONTRACT_REFUND_APPLY_CLOSED_TREATED_AS_TERMINAL'; end if;
  update public.wechat_refund_commands set available_at=now() where id=command_id;
  select * into strict claim from public.api_claim_wechat_refund_commands('refund-closed-worker',1,30);
  perform public.api_record_wechat_refund_result(
    claim.id,claim.provider_attempt_id,'refund-closed-worker',claim.lease_token,
    'CLOSED','500000CLOSED'||upper(suffix),'closed-query-'||suffix,
    claim.out_refund_no,claim.out_trade_no,claim.transaction_id,
    claim.amount_cents,claim.payment_total_cents,claim.currency
  );
  select * into strict claim from public.api_claim_wechat_refund_events('refund-closed-event',1,30);
  result:=public.api_execute_wechat_refund_event(claim.id,'refund-closed-event',claim.lease_token);
  if result->>'status'<>'delivered'
     or (select status from public.refunds where id=refund_id)<>'failed'
     or (select status from public.after_sales where id=after_sale_ids[1])<>'closed'
     or (select status from public.orders where id=order_ids[1])<>'paid'
     or (select status from public.payments where id=payment_ids[1])<>'succeeded'
     or exists(select 1 from public.finance_journals journal
       where journal.refund_id=wechat_refund_terminal_contract.refund_id)
  then raise exception 'CONTRACT_REFUND_CLOSED_EFFECT_INVALID'; end if;

  perform public.api_request_refund_authorized(
    'user-test-owner',after_sale_ids[2],1000,'refund-failure-'||suffix,
    'refund-failure-hash-'||suffix,'refund-failure-request','contract',
    'membership-test-owner-admin',evidence
  );
  select command.id,command.refund_id into strict command_id,refund_id
  from public.wechat_refund_commands command where command.after_sale_id=after_sale_ids[2];
  select * into strict claim from public.api_claim_wechat_refund_commands('refund-failure-worker',1,30);
  result:=public.api_fail_wechat_refund_attempt(
    claim.id,claim.provider_attempt_id,'refund-failure-worker',claim.lease_token,
    'invalid request!',false
  );
  if result->>'status'<>'dead_letter'
     or (select error_code from public.wechat_refund_provider_attempts where id=claim.provider_attempt_id)<>'INVALIDREQUEST'
     or not exists(select 1 from public.notification_dispatches notification
       where notification.refund_id=wechat_refund_terminal_contract.refund_id
         and notification.template_key='refund.manual_review')
     or exists(select 1 from public.finance_journals journal
       where journal.refund_id=wechat_refund_terminal_contract.refund_id)
  then raise exception 'CONTRACT_REFUND_COMMAND_DEADLETTER_INVALID'; end if;
end wechat_refund_terminal_contract;
$$;

rollback;
