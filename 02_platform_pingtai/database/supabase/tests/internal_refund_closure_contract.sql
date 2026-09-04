begin;

do $$
<<internal_refund_closure_contract>>
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  owner_session uuid:=gen_random_uuid(); owner_factor text:='internal-refund-factor-'||suffix;
  verified_at timestamptz:=clock_timestamp(); owner_authz integer; owner_credential integer;
  evidence jsonb; order_id text:='internal-refund-order-'||suffix;
  after_sale_id text:='internal-refund-as-'||suffix; intent_id uuid:=gen_random_uuid();
  welfare_payment text:='internal-refund-welfare-'||suffix;
  meal_payment text:='internal-refund-meal-'||suffix;
  capture_event uuid:=gen_random_uuid(); capture_inbox uuid;
  capture_effect uuid:=gen_random_uuid(); capture_journal uuid;
  welfare_balance_before bigint; meal_balance_before bigint;
  result jsonb; error_message text;
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
    owner_credential,'internal-refund','internal-refund','internal-refund',now()+interval '1 hour'
  );
  insert into public.admin_mfa_factors(
    id,tenant_id,user_id,factor_type,secret_ciphertext,label,status
  ) values(
    owner_factor,'tenant-smart-wing','user-test-owner','totp',repeat('a',32),
    'Internal refund contract','active'
  ) on conflict(user_id,factor_type) do update set status='active' returning id into owner_factor;
  insert into public.admin_step_up_challenges(
    id,membership_id,user_id,session_id,factor_id,status,attempts,
    request_id,created_at,expires_at,verified_at,updated_at
  ) values(
    'internal-refund-stepup-'||suffix,'membership-test-owner-admin','user-test-owner',
    owner_session::text,owner_factor,'verified',0,'internal-refund-stepup-'||suffix,
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
    order_id,'INTERNAL-REFUND-'||suffix,'tenant-smart-wing','enterprise-demo',
    'mall-demo','user-test-storefront','refund_pending',1000,0,1000,1000,'{}',now()
  );
  insert into public.payment_intents(
    id,tenant_id,mall_id,user_id,order_id,source,currency,amount_cents,
    status,idempotency_key,completed_at
  ) values(
    intent_id,'tenant-smart-wing','mall-demo','user-test-storefront',order_id,
    'internal','CNY',1000,'succeeded','internal-refund-intent-'||suffix,now()
  );
  insert into public.payments(
    id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,
    amount_cents,idempotency_key,completed_at,payment_intent_id
  ) values
    (welfare_payment,'INTERNAL-REFUND-WELFARE-'||suffix,'tenant-smart-wing',
      'mall-demo','user-test-storefront',order_id,'welfare','succeeded',400,
      'internal-refund-welfare-'||suffix,now(),intent_id),
    (meal_payment,'INTERNAL-REFUND-MEAL-'||suffix,'tenant-smart-wing',
      'mall-demo','user-test-storefront',order_id,'meal','succeeded',600,
      'internal-refund-meal-'||suffix,now(),intent_id);
  insert into public.payment_allocations(
    id,tenant_id,mall_id,payment_id,order_id,account_id,channel,amount_cents
  ) values
    ('internal-refund-welfare-allocation-'||suffix,'tenant-smart-wing','mall-demo',
      welfare_payment,order_id,'acct-user-test-storefront-welfare','welfare',400),
    ('internal-refund-meal-allocation-'||suffix,'tenant-smart-wing','mall-demo',
      meal_payment,order_id,'acct-user-test-storefront-meal','meal',600);
  insert into public.account_ledgers(
    id,tenant_id,mall_id,account_id,user_id,direction,amount_cents,
    balance_after_cents,business_type,business_id,idempotency_key
  ) values
    ('internal-refund-welfare-ledger-'||suffix,'tenant-smart-wing','mall-demo',
      'acct-user-test-storefront-welfare','user-test-storefront','debit',400,0,
      'order_payment',order_id,'internal-refund-welfare-ledger-'||suffix),
    ('internal-refund-meal-ledger-'||suffix,'tenant-smart-wing','mall-demo',
      'acct-user-test-storefront-meal','user-test-storefront','debit',600,0,
      'order_payment',order_id,'internal-refund-meal-ledger-'||suffix);
  insert into public.after_sales(
    id,after_sale_no,tenant_id,mall_id,user_id,order_id,type,status,reason,
    requested_amount_cents,requested_by_membership_id,requested_by_member_id,
    order_status_before_request,migration_status
  ) values(
    after_sale_id,'INTERNAL-REFUND-AS-'||suffix,'tenant-smart-wing','mall-demo',
    'user-test-storefront',order_id,'refund_only','approved','内部组合支付原路退款',
    1000,'membership-test-storefront','member-test-storefront','paid','ready'
  );
  insert into public.payment_outbox(
    id,event_key,source,topic,order_id,payment_id,payment_intent_id,
    attempt_id,payload_json,status,delivered_at
  ) values(
    capture_event,'internal-refund-capture:'||suffix,'internal','order.payment_succeeded',
    order_id,null,intent_id,null,jsonb_build_object('orderId',order_id),'delivered',now()
  );
  insert into public.payment_event_inbox(
    outbox_id,event_key,tenant_id,aggregate_id,aggregate_version,
    event_type,payload_digest,consumer
  ) select id,event_key,tenant_id,aggregate_id,aggregate_version,event_type,
    encode(digest(event_key,'sha256'),'hex'),'internal-refund-contract'
  from public.payment_outbox where id=capture_event returning id into capture_inbox;
  insert into public.payment_event_effects(
    id,inbox_id,outbox_id,tenant_id,order_id,payment_id,payment_intent_id,
    effect_type,status,payload_json,completed_at
  ) values(
    capture_effect,capture_inbox,capture_event,'tenant-smart-wing',order_id,null,
    intent_id,'accounting','succeeded','{"contract":true}',now()
  );
  insert into public.finance_journals(
    tenant_id,mall_id,order_id,payment_id,payment_intent_id,source_effect_id,
    refund_id,journal_type,business_reference,currency,amount_cents,status,occurred_at
  ) values(
    'tenant-smart-wing','mall-demo',order_id,null,intent_id,capture_effect,null,
    'payment_capture','payment-intent:'||intent_id,'CNY',1000,'posted',now()
  ) returning id into capture_journal;
  insert into public.finance_journal_entries(
    journal_id,tenant_id,mall_id,order_id,payment_id,payment_intent_id,
    account_code,side,amount_cents,subject_type,subject_id
  ) values
    (capture_journal,'tenant-smart-wing','mall-demo',order_id,welfare_payment,null,
      'liability:welfare_balance','debit',400,'order',order_id),
    (capture_journal,'tenant-smart-wing','mall-demo',order_id,meal_payment,null,
      'liability:meal_balance','debit',600,'order',order_id),
    (capture_journal,'tenant-smart-wing','mall-demo',order_id,null,intent_id,
      'liability:customer_payment_clearing','credit',1000,'order',order_id);
  set constraints all immediate; set constraints all deferred;
  select balance_cents into strict welfare_balance_before
  from public.welfare_accounts where id='acct-user-test-storefront-welfare';
  select balance_cents into strict meal_balance_before
  from public.welfare_accounts where id='acct-user-test-storefront-meal';

  begin
    perform public.api_request_refund_authorized(
      'user-test-owner',after_sale_id,500,'refund-internal-partial-'||suffix,
      'refund-internal-partial-hash-'||suffix,'refund-internal-partial-request',
      'contract','membership-test-owner-admin',evidence
    );
    raise exception 'CONTRACT_INTERNAL_MULTI_TENDER_PARTIAL_ALLOCATION_GUESSED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%REFUND_ALLOCATION_RULE_REQUIRED%' then raise; end if;
  end;
  if (select balance_cents from public.welfare_accounts
        where id='acct-user-test-storefront-welfare')<>welfare_balance_before
     or (select balance_cents from public.welfare_accounts
        where id='acct-user-test-storefront-meal')<>meal_balance_before
     or exists(select 1 from public.refunds refund
        where refund.order_id=internal_refund_closure_contract.order_id)
     or exists(select 1 from public.finance_journals journal
        where journal.order_id=internal_refund_closure_contract.order_id
          and journal.journal_type='payment_refund')
     or exists(select 1 from public.account_ledgers
        where business_id=internal_refund_closure_contract.order_id and business_type='order_refund')
  then raise exception 'CONTRACT_INTERNAL_MULTI_TENDER_PARTIAL_MUTATED_MONEY_STATE'; end if;

  result:=public.api_request_refund_authorized(
    'user-test-owner',after_sale_id,1000,'refund-internal-'||suffix,
    'refund-internal-hash-'||suffix,'refund-internal-request','contract',
    'membership-test-owner-admin',evidence
  );
  begin
    perform public.api_request_refund_authorized(
      'user-test-owner',after_sale_id,999,'refund-internal-'||suffix,
      'refund-internal-hash-'||suffix,'refund-internal-conflict','contract',
      'membership-test-owner-admin',evidence
    );
    raise exception 'CONTRACT_INTERNAL_SAME_HASH_DIFFERENT_AMOUNT_REPLAYED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%IDEMPOTENCY_CONFLICT%' then raise; end if;
  end;
  set constraints all immediate; set constraints all deferred;
  if result#>>'{refund,status}'<>'succeeded'
     or (select status from public.orders where id=order_id)<>'refunded'
     or (select count(*) from public.payments payment
       where payment.order_id=internal_refund_closure_contract.order_id
         and payment.status='refunded')<>2
     or (select count(*) from public.refunds refund
       where refund.order_id=internal_refund_closure_contract.order_id
         and refund.status='succeeded')<>2
     or (select count(*) from public.finance_journals journal
       where journal.order_id=internal_refund_closure_contract.order_id
         and journal.journal_type='payment_refund')<>2
     or (select coalesce(sum(journal.amount_cents),0) from public.finance_journals journal
       where journal.order_id=internal_refund_closure_contract.order_id
         and journal.journal_type='payment_refund')<>1000
  then raise exception 'CONTRACT_INTERNAL_REFUND_JOURNALS_INVALID'; end if;
end internal_refund_closure_contract;
$$;

rollback;
