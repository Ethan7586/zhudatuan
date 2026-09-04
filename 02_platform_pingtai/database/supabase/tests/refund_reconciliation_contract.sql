begin;

do $$
<<refund_reconciliation_contract>>
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  owner_session uuid:=gen_random_uuid(); owner_authz integer; owner_credential integer;
  evidence jsonb; internal_order text:='refund-reconcile-internal-'||suffix;
  wechat_order text:='refund-reconcile-wechat-'||suffix;
  gap_order text:='refund-reconcile-gap-'||suffix; intent_id uuid:=gen_random_uuid();
  welfare_payment text:='refund-reconcile-welfare-'||suffix;
  meal_payment text:='refund-reconcile-meal-'||suffix;
  wechat_payment text:='refund-reconcile-wechat-pay-'||suffix;
  gap_payment text:='refund-reconcile-gap-pay-'||suffix;
  identity_id uuid:=gen_random_uuid(); attempt_id uuid:=gen_random_uuid();
  capture_event uuid; capture_inbox uuid; capture_effect uuid; capture_journal uuid;
  ordinal integer; orders text[]; payments text[]; intents uuid[]; attempts uuid[];
  sources text[]; reconciliation jsonb; error_message text;
begin
  insert into public.role_permissions(role_id,permission_id)
  select 'role-platform-owner-v2',id from public.permissions where code='finance.reconcile'
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
    owner_credential,'refund-reconcile','refund-reconcile','refund-reconcile',now()+interval '1 hour'
  );
  evidence:=jsonb_build_object(
    'sessionId',owner_session,'membershipId','membership-test-owner-admin',
    'authzVersion',owner_authz,'permission','finance.reconcile'
  );

  insert into public.orders(
    id,order_no,tenant_id,enterprise_id,mall_id,user_id,status,
    goods_amount_cents,discount_cents,payable_cents,paid_cents,
    recipient_snapshot_json,paid_at
  ) values
    (internal_order,'REFUND-RECONCILE-INTERNAL-'||suffix,'tenant-smart-wing',
      'enterprise-demo','mall-demo','user-test-storefront','refunded',1000,0,1000,1000,'{}',now()),
    (wechat_order,'REFUND-RECONCILE-WECHAT-'||suffix,'tenant-smart-wing',
      'enterprise-demo','mall-demo','user-test-storefront','refunded',1000,0,1000,1000,'{}',now()),
    (gap_order,'REFUND-RECONCILE-GAP-'||suffix,'tenant-smart-wing',
      'enterprise-demo','mall-demo','user-test-storefront','refund_pending',1000,0,1000,1000,'{}',now());
  insert into public.payment_intents(
    id,tenant_id,mall_id,user_id,order_id,source,currency,amount_cents,
    status,idempotency_key,completed_at
  ) values(
    intent_id,'tenant-smart-wing','mall-demo','user-test-storefront',internal_order,
    'internal','CNY',1000,'succeeded','refund-reconcile-intent-'||suffix,now()
  );
  insert into public.payments(
    id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,
    amount_cents,provider_trade_no,idempotency_key,completed_at,payment_intent_id
  ) values
    (welfare_payment,'REFUND-RECONCILE-WELFARE-'||suffix,'tenant-smart-wing','mall-demo',
      'user-test-storefront',internal_order,'welfare','refunded',400,null,
      'refund-reconcile-welfare-'||suffix,now(),intent_id),
    (meal_payment,'REFUND-RECONCILE-MEAL-'||suffix,'tenant-smart-wing','mall-demo',
      'user-test-storefront',internal_order,'meal','refunded',600,null,
      'refund-reconcile-meal-'||suffix,now(),intent_id),
    (wechat_payment,'REFUND-RECONCILE-WECHAT-PAY-'||suffix,'tenant-smart-wing','mall-demo',
      'user-test-storefront',wechat_order,'wechat','refunded',1000,
      '420000RECONCILE'||upper(suffix),'refund-reconcile-wechat-'||suffix,now(),null),
    (gap_payment,'REFUND-RECONCILE-GAP-PAY-'||suffix,'tenant-smart-wing','mall-demo',
      'user-test-storefront',gap_order,'wechat','succeeded',1000,
      '420000GAP'||upper(suffix),'refund-reconcile-gap-'||suffix,now(),null);
  insert into public.payment_allocations(
    id,tenant_id,mall_id,payment_id,order_id,account_id,channel,amount_cents
  ) values
    ('refund-reconcile-welfare-allocation-'||suffix,'tenant-smart-wing','mall-demo',
      welfare_payment,internal_order,'acct-user-test-storefront-welfare','welfare',400),
    ('refund-reconcile-meal-allocation-'||suffix,'tenant-smart-wing','mall-demo',
      meal_payment,internal_order,'acct-user-test-storefront-meal','meal',600);
  insert into public.account_ledgers(
    id,tenant_id,mall_id,account_id,user_id,direction,amount_cents,
    balance_after_cents,business_type,business_id,idempotency_key
  ) values
    ('refund-reconcile-welfare-pay-'||suffix,'tenant-smart-wing','mall-demo',
      'acct-user-test-storefront-welfare','user-test-storefront','debit',400,0,
      'order_payment',internal_order,'refund-reconcile-welfare-pay-'||suffix),
    ('refund-reconcile-meal-pay-'||suffix,'tenant-smart-wing','mall-demo',
      'acct-user-test-storefront-meal','user-test-storefront','debit',600,0,
      'order_payment',internal_order,'refund-reconcile-meal-pay-'||suffix),
    ('refund-reconcile-welfare-refund-'||suffix,'tenant-smart-wing','mall-demo',
      'acct-user-test-storefront-welfare','user-test-storefront','credit',400,400,
      'order_refund',internal_order,'refund-reconcile-welfare-refund-'||suffix),
    ('refund-reconcile-meal-refund-'||suffix,'tenant-smart-wing','mall-demo',
      'acct-user-test-storefront-meal','user-test-storefront','credit',600,600,
      'order_refund',internal_order,'refund-reconcile-meal-refund-'||suffix);
  insert into public.member_wechat_identities(id,app_id,open_id)
  values(identity_id,'wxreconcile'||suffix,'openid-reconcile-'||suffix);
  insert into public.wechat_payment_attempts(
    id,payment_id,order_id,identity_id,created_by_membership_id,app_id,mch_id,
    out_trade_no,description,amount_total,payer_openid_hash,status,
    transaction_id,provider_trade_state,completed_at
  ) values(
    attempt_id,wechat_payment,wechat_order,identity_id,'membership-test-storefront',
    'wxreconcile'||suffix,'190000contract','RRC'||upper(suffix),'Refund reconciliation',
    1000,repeat('6',64),'succeeded','420000RECONCILE'||upper(suffix),'SUCCESS',now()
  );

  orders:=array[internal_order,wechat_order]; payments:=array[null,wechat_payment];
  intents:=array[intent_id,null]; attempts:=array[null,attempt_id];
  sources:=array['internal','wechat'];
  for ordinal in 1..2 loop
    capture_event:=gen_random_uuid(); capture_effect:=gen_random_uuid();
    insert into public.payment_outbox(
      id,event_key,source,topic,order_id,payment_id,payment_intent_id,
      attempt_id,payload_json,status,delivered_at
    ) values(
      capture_event,'refund-reconcile-capture-'||ordinal||':'||suffix,sources[ordinal],
      'order.payment_succeeded',orders[ordinal],payments[ordinal],intents[ordinal],
      attempts[ordinal],jsonb_build_object('orderId',orders[ordinal]),'delivered',now()
    );
    insert into public.payment_event_inbox(
      outbox_id,event_key,tenant_id,aggregate_id,aggregate_version,
      event_type,payload_digest,consumer
    ) select id,event_key,tenant_id,aggregate_id,aggregate_version,event_type,
      encode(digest(event_key,'sha256'),'hex'),'refund-reconciliation-contract'
    from public.payment_outbox where id=capture_event returning id into capture_inbox;
    insert into public.payment_event_effects(
      id,inbox_id,outbox_id,tenant_id,order_id,payment_id,payment_intent_id,
      effect_type,status,payload_json,completed_at
    ) values(
      capture_effect,capture_inbox,capture_event,'tenant-smart-wing',orders[ordinal],
      payments[ordinal],intents[ordinal],'accounting','succeeded','{"contract":true}',now()
    );
    insert into public.finance_journals(
      tenant_id,mall_id,order_id,payment_id,payment_intent_id,source_effect_id,
      refund_id,journal_type,business_reference,currency,amount_cents,status,occurred_at
    ) values(
      'tenant-smart-wing','mall-demo',orders[ordinal],payments[ordinal],intents[ordinal],
      capture_effect,null,'payment_capture',case when ordinal=1
        then 'payment-intent:'||intent_id else 'payment:'||wechat_payment end,
      'CNY',1000,'posted',now()
    ) returning id into capture_journal;
    if ordinal=1 then
      insert into public.finance_journal_entries(
        journal_id,tenant_id,mall_id,order_id,payment_id,payment_intent_id,
        account_code,side,amount_cents,subject_type,subject_id
      ) values
        (capture_journal,'tenant-smart-wing','mall-demo',internal_order,welfare_payment,
          null,'liability:welfare_balance','debit',400,'order',internal_order),
        (capture_journal,'tenant-smart-wing','mall-demo',internal_order,meal_payment,
          null,'liability:meal_balance','debit',600,'order',internal_order),
        (capture_journal,'tenant-smart-wing','mall-demo',internal_order,null,intent_id,
          'liability:customer_payment_clearing','credit',1000,'order',internal_order);
    else
      insert into public.finance_journal_entries(
        journal_id,tenant_id,mall_id,order_id,payment_id,payment_intent_id,
        account_code,side,amount_cents,subject_type,subject_id
      ) values
        (capture_journal,'tenant-smart-wing','mall-demo',wechat_order,wechat_payment,
          null,'asset:wechat_receivable','debit',1000,'order',wechat_order),
        (capture_journal,'tenant-smart-wing','mall-demo',wechat_order,wechat_payment,
          null,'liability:customer_payment_clearing','credit',1000,'order',wechat_order);
    end if;
  end loop;
  insert into public.refunds(
    id,refund_no,tenant_id,mall_id,order_id,payment_id,amount_cents,status,
    reason,idempotency_key,completed_at
  ) values
    ('refund-reconcile-welfare-refund-'||suffix,'RRW'||upper(suffix),'tenant-smart-wing',
      'mall-demo',internal_order,welfare_payment,400,'succeeded','对账内部福利退款',
      'refund-reconcile-welfare-refund-'||suffix,now()),
    ('refund-reconcile-meal-refund-'||suffix,'RRM'||upper(suffix),'tenant-smart-wing',
      'mall-demo',internal_order,meal_payment,600,'succeeded','对账内部餐补退款',
      'refund-reconcile-meal-refund-'||suffix,now()),
    ('refund-reconcile-wechat-refund-'||suffix,'RRWCH'||upper(suffix),'tenant-smart-wing',
      'mall-demo',wechat_order,wechat_payment,1000,'succeeded','对账微信退款',
      'refund-reconcile-wechat-refund-'||suffix,now());
  set constraints all immediate; set constraints all deferred;

  begin
    perform public.api_finance_reconciliation_authorized(
      'membership-test-owner-admin','user-test-owner','tenant-smart-wing',
      'enterprise-demo','mall-other',evidence
    );
    raise exception 'CONTRACT_FINANCE_RECONCILIATION_CROSS_SCOPE_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%FINANCE_RECONCILIATION_NOT_AUTHORIZED%' then raise; end if;
  end;
  begin
    perform public.api_finance_reconciliation_authorized(
      'membership-test-owner-admin','user-test-owner','tenant-smart-wing',
      'enterprise-demo','mall-demo',evidence||jsonb_build_object('sessionId',gen_random_uuid())
    );
    raise exception 'CONTRACT_FINANCE_RECONCILIATION_STALE_SESSION_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%FINANCE_RECONCILIATION_NOT_AUTHORIZED%' then raise; end if;
  end;
  reconciliation:=public.api_finance_reconciliation_authorized(
    'membership-test-owner-admin','user-test-owner','tenant-smart-wing',
    'enterprise-demo','mall-demo',evidence
  );
  if exists(select 1 from jsonb_array_elements(reconciliation->'violations') violation
      where violation->>'orderId' in(internal_order,wechat_order))
  then raise exception 'CONTRACT_REFUND_RECONCILIATION_FALSE_DIFFERENCE:%',reconciliation; end if;
  if not exists(select 1 from jsonb_array_elements(reconciliation->'violations') violation
      where violation->>'orderId'=gap_order and violation->'issues'?'CAPTURE_JOURNAL_MISMATCH')
  then raise exception 'CONTRACT_REFUND_RECONCILIATION_MISSED_CAPTURE_GAP:%',reconciliation; end if;
end refund_reconciliation_contract;
$$;

rollback;
