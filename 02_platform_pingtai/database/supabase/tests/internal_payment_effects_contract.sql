begin;
do $$
declare suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  session_id uuid:=gen_random_uuid(); authz integer; credential integer;
  owner_session uuid:=gen_random_uuid(); owner_factor text:='intent-refund-factor-'||suffix;
  owner_challenge text:='intent-refund-stepup-'||suffix;
  owner_authz integer; owner_credential integer; verified_at timestamptz:=clock_timestamp();
  evidence jsonb; stock_id text:='contract-intent-stock-'||suffix;
  location_id text:='contract-intent-location-'||suffix;
  orders text[]:=array['contract-welfare-'||suffix,'contract-meal-'||suffix,
    'contract-combo-a-'||suffix,'contract-combo-b-'||suffix];
  welfare bigint[]:=array[100,0,40,70]; meal bigint[]:=array[0,100,60,30];
  expected_tenders integer[]:=array[1,1,2,2]; ordinal integer;
  claim record; pass integer; result jsonb; first_response jsonb;
  replay_response jsonb; intent_id uuid; accounting_effect uuid;
  partial_intent uuid; partial_after_sale text:='contract-intent-partial-as-'||suffix;
  partial_order text; full_order text; full_intent uuid; full_payment text;
  full_effect uuid; full_after_sale text:='contract-intent-full-as-'||suffix;
  refund_evidence jsonb; debit bigint; credit bigint; error_message text;
  balance_before bigint; intent_count bigint; outbox_count bigint;
begin
  update public.payment_event_effects set status='dead_letter',
    dead_lettered_at=now(),locked_by=null,locked_at=null,
    lease_token=null,lease_expires_at=null
  where status in('pending','processing');
  update public.payment_outbox set status='dead_letter',
    dead_lettered_at=now(),locked_by=null,locked_at=null,
    lease_token=null,lease_expires_at=null
  where status in('pending','processing');
  select membership.authz_version,coalesce(identity.credential_version,0)
  into strict authz,credential from public.memberships membership
  left join public.member_credentials identity
    on identity.member_id=membership.member_id
  where membership.id='membership-test-storefront';
  insert into public.auth_sessions(id,member_id,membership_id,target,
    credential_version,ip_hash,user_agent,device_label,expires_at)
  values(session_id,'member-test-storefront','membership-test-storefront',
    'storefront',credential,'internal-effect-contract','contract','contract',
    now()+interval '1 hour');
  evidence:=jsonb_build_object('sessionId',session_id,
    'membershipId','membership-test-storefront','authzVersion',authz,
    'permission','order.create');
  insert into public.role_permissions(role_id,permission_id)
  select 'role-platform-owner-v2',permission.id from public.permissions permission
  where permission.code='order.refund' on conflict do nothing;
  select membership.authz_version,coalesce(identity.credential_version,0)
  into strict owner_authz,owner_credential from public.memberships membership
  left join public.member_credentials identity on identity.member_id=membership.member_id
  where membership.id='membership-test-owner-admin';
  insert into public.auth_sessions(id,member_id,membership_id,target,
    credential_version,ip_hash,user_agent,device_label,expires_at)
  values(owner_session,'member-test-owner','membership-test-owner-admin','admin',
    owner_credential,'internal-intent-refund','contract','contract',now()+interval '1 hour');
  insert into public.admin_mfa_factors(id,tenant_id,user_id,factor_type,
    secret_ciphertext,label,status)
  values(owner_factor,'tenant-smart-wing','user-test-owner','totp',repeat('a',32),
    'Internal intent refund','active')
  on conflict(user_id,factor_type) do update set status='active' returning id into owner_factor;
  insert into public.admin_step_up_challenges(id,membership_id,user_id,session_id,
    factor_id,status,attempts,request_id,created_at,expires_at,verified_at,updated_at)
  values(owner_challenge,'membership-test-owner-admin','user-test-owner',
    owner_session::text,owner_factor,'verified',0,'intent-refund-stepup-'||suffix,
    verified_at,verified_at+interval '5 minutes',verified_at,verified_at);
  refund_evidence:=jsonb_build_object('sessionId',owner_session,
    'membershipId','membership-test-owner-admin','authzVersion',owner_authz,
    'permission','order.refund','stepUpAt',verified_at);
  update public.member_identity_assurances set phone_verified_at=now(),
    phone_verification_method='sms_otp',updated_at=now()
  where member_id='member-test-storefront';
  update public.welfare_accounts set balance_cents=10000,status='active',
    version=version+1,updated_at=now()
  where tenant_id='tenant-smart-wing' and enterprise_id='enterprise-demo'
    and mall_id='mall-demo' and user_id='user-test-storefront'
    and account_type in('welfare','meal');
  insert into inventory.stock_items(id,tenant_id,mall_id,sku_id,
    location_id,onhand,safety)
  values(stock_id,'tenant-smart-wing','mall-demo','sku-rice-5kg',
    location_id,100,0);
  for ordinal in 1..4 loop
    insert into public.orders(id,order_no,tenant_id,enterprise_id,mall_id,
      user_id,status,goods_amount_cents,discount_cents,payable_cents,
      paid_cents,recipient_snapshot_json)
    values(orders[ordinal],'CONTRACT-INTENT-'||ordinal||'-'||suffix,
      'tenant-smart-wing','enterprise-demo','mall-demo',
      'user-test-storefront','pending_payment',100,0,100,0,'{}');
    insert into public.sub_orders(id,sub_order_no,tenant_id,mall_id,
      parent_order_id,supplier_id,status,amount_cents)
    values('contract-intent-sub-'||ordinal||'-'||suffix,
      'CONTRACT-INTENT-SUB-'||ordinal||'-'||suffix,'tenant-smart-wing',
      'mall-demo',orders[ordinal],'supplier-central','pending_payment',100);
    insert into public.order_items(id,tenant_id,mall_id,order_id,sub_order_id,
      product_id,sku_id,product_name_snapshot,specs_snapshot_json,
      unit_price_cents,quantity,line_amount_cents)
    values('contract-intent-item-'||ordinal||'-'||suffix,
      'tenant-smart-wing','mall-demo',orders[ordinal],
      'contract-intent-sub-'||ordinal||'-'||suffix,'product-rice',
      'sku-rice-5kg','契约商品','{}',100,1,100);
    perform inventory.reserve('tenant-smart-wing','mall-demo',orders[ordinal],
      jsonb_build_array(jsonb_build_object('skuId','sku-rice-5kg',
        'locationId',location_id,'quantity',1)),
      'contract-intent-reserve-'||ordinal||'-'||suffix,
      now()+interval '15 minutes');
    result:=public.api_pay_internal_authorized('tenant-smart-wing',
      'enterprise-demo','mall-demo','user-test-storefront',orders[ordinal],
      welfare[ordinal],meal[ordinal],
      'contract-intent-pay-'||ordinal||'-'||suffix,repeat(chr(64+ordinal),43)||'=',
      'contract-intent-request-'||ordinal||'-'||suffix,'contract',
      'membership-test-storefront',evidence);
    if ordinal=3 then first_response:=result; end if;
  end loop;
  replay_response:=public.api_pay_internal_authorized('tenant-smart-wing',
    'enterprise-demo','mall-demo','user-test-storefront',orders[3],40,60,
    'contract-intent-pay-3-'||suffix,repeat('C',43)||'=',
    'contract-intent-replay-'||suffix,'contract',
    'membership-test-storefront',evidence);
  if replay_response<>first_response then
    raise exception 'CONTRACT_INTERNAL_INTENT_REPLAY_CHANGED'; end if;
  if (select count(*) from public.payment_intents
      where order_id=any(orders))<>4
    or (select count(*) from public.payment_outbox
      where source='internal' and order_id=any(orders))<>4
    or exists(select 1 from public.payment_outbox where source='internal'
      and order_id=any(orders) and(payment_id is not null
        or attempt_id is not null or payment_intent_id is null))
  then raise exception 'CONTRACT_INTERNAL_INTENT_OUTBOX_INVALID'; end if;

  for claim in select * from public.api_claim_payment_outbox(
    'internal','contract-intent-relay',20,30) loop
    result:=public.api_start_payment_effects('internal',claim.id,
      'contract-intent-relay',claim.lease_token);
    if result->>'effectCount'<>'3' then
      raise exception 'CONTRACT_INTERNAL_INTENT_FANOUT_INVALID'; end if;
    result:=public.api_finish_payment_outbox('internal',claim.id,
      'contract-intent-relay',claim.lease_token,true,null);
    if result->>'status'<>'delivered' then
      raise exception 'CONTRACT_INTERNAL_INTENT_RELAY_INVALID'; end if;
  end loop;
  for pass in 1..4 loop
    for claim in select * from public.api_claim_payment_event_effects(
      'contract-intent-effect',20,30) loop
      result:=public.api_execute_payment_event_effect(claim.id,
        'contract-intent-effect',claim.lease_token);
      if result->>'status'<>'succeeded' then
        raise exception 'CONTRACT_INTERNAL_INTENT_EFFECT_INVALID:%',result;
      end if;
    end loop;
  end loop;
  if exists(select 1 from public.payment_event_effects effect
    join public.payment_outbox outbox on outbox.id=effect.outbox_id
    where outbox.order_id=any(orders) and effect.status<>'succeeded')
  then raise exception 'CONTRACT_INTERNAL_INTENT_EFFECT_DRAIN_INCOMPLETE'; end if;
  for ordinal in 1..4 loop
    select id into strict intent_id from public.payment_intents
      where order_id=orders[ordinal];
    select coalesce(sum(entry.amount_cents) filter(where entry.side='debit'),0),
      coalesce(sum(entry.amount_cents) filter(where entry.side='credit'),0)
    into debit,credit from public.finance_journal_entries entry
    join public.finance_journals journal on journal.id=entry.journal_id
    where journal.payment_intent_id=intent_id;
    if (select count(*) from public.payments
        where payment_intent_id=intent_id)<>expected_tenders[ordinal]
      or (select count(*) from public.finance_journals
        where payment_intent_id=intent_id)<>1
      or (select count(*) from public.finance_journal_entries entry
        join public.finance_journals journal on journal.id=entry.journal_id
        where journal.payment_intent_id=intent_id)
          <>expected_tenders[ordinal]+1
      or debit<>100 or credit<>100 or debit<>credit
      or (select count(*) from public.fulfillment_orders
        where payment_intent_id=intent_id and payment_id is null
          and status='queued')<>1
      or (select count(*) from public.notification_dispatches
        where payment_intent_id=intent_id and payment_id is null
          and status='pending' and sent_at is null
          and provider_reference is null)<>1
    then raise exception 'CONTRACT_INTERNAL_INTENT_EFFECT_RESULT_INVALID:%',ordinal;
    end if;
  end loop;
  select id into strict intent_id from public.payment_intents
    where order_id=orders[3];
  if not exists(select 1 from public.finance_journal_entries entry
      join public.finance_journals journal on journal.id=entry.journal_id
      where journal.payment_intent_id=intent_id
        and entry.account_code='liability:welfare_balance'
        and entry.side='debit' and entry.amount_cents=40)
    or not exists(select 1 from public.finance_journal_entries entry
      join public.finance_journals journal on journal.id=entry.journal_id
      where journal.payment_intent_id=intent_id
        and entry.account_code='liability:meal_balance'
        and entry.side='debit' and entry.amount_cents=60)
  then raise exception 'CONTRACT_INTERNAL_COMBINATION_JOURNAL_INVALID'; end if;
  select effect.id into strict accounting_effect
  from public.payment_event_effects effect
  where effect.payment_intent_id=intent_id and effect.effect_type='accounting';
  perform public.process_payment_accounting_effect(accounting_effect);
  if (select count(*) from public.finance_journals
      where payment_intent_id=intent_id)<>1
  then raise exception 'CONTRACT_INTERNAL_JOURNAL_NOT_IDEMPOTENT'; end if;
  partial_order:=orders[1];
  select id into strict partial_intent from public.payment_intents
  where order_id=partial_order;
  select balance_cents into strict balance_before from public.welfare_accounts
  where tenant_id='tenant-smart-wing' and mall_id='mall-demo'
    and user_id='user-test-storefront' and account_type='welfare';
  select count(*) into intent_count from public.payment_intents where order_id=partial_order;
  select count(*) into outbox_count from public.payment_outbox where order_id=partial_order;
  insert into public.after_sales(id,after_sale_no,tenant_id,mall_id,user_id,
    order_id,type,status,reason,requested_amount_cents,requested_by_membership_id,
    requested_by_member_id,order_status_before_request,migration_status)
  values(partial_after_sale,'CONTRACT-INTENT-PARTIAL-AS-'||suffix,
    'tenant-smart-wing','mall-demo','user-test-storefront',partial_order,
    'refund_only','approved','单通道部分退款',40,'membership-test-storefront',
    'member-test-storefront','paid','ready');
  update public.orders target set status='refund_pending',updated_at=now()
  where target.id=partial_order;
  result:=public.api_request_refund_authorized('user-test-owner',partial_after_sale,40,
    'contract-intent-partial-refund-'||suffix,'contract-intent-partial-hash-'||suffix,
    'contract-intent-partial-request-'||suffix,'contract',
    'membership-test-owner-admin',refund_evidence);
  if result#>>'{refund,status}'<>'succeeded'
    or(select status from public.orders target where target.id=partial_order)<>'paid'
    or(select status from public.after_sales where id=partial_after_sale)<>'completed'
    or(select status from public.payments payment
      where payment.order_id=partial_order)<>'succeeded'
    or(select count(*) from public.payment_intents where order_id=partial_order)<>intent_count
    or(select id from public.payment_intents where order_id=partial_order)<>partial_intent
    or(select count(*) from public.payment_outbox where order_id=partial_order)<>outbox_count
    or(select count(*) from public.refunds where order_id=partial_order
      and status='succeeded' and amount_cents=40)<>1
    or(select balance_cents from public.welfare_accounts
      where tenant_id='tenant-smart-wing' and mall_id='mall-demo'
        and user_id='user-test-storefront' and account_type='welfare')<>balance_before+40
    or(select count(*) from public.fulfillment_orders
      where payment_intent_id=partial_intent)<>1
    or(select count(*) from public.notification_dispatches
      where payment_intent_id=partial_intent)<>1
  then raise exception 'CONTRACT_INTERNAL_PARTIAL_REFUND_REEMITTED_CAPTURE'; end if;
  if not public.internal_payment_intent_valid(partial_intent)
  then raise exception 'CONTRACT_INTERNAL_PARTIAL_REFUND_INVALIDATED_CAPTURE'; end if;

  full_order:=orders[2];
  select id into strict full_intent from public.payment_intents
  where order_id=full_order;
  select id into strict full_payment from public.payments
  where payment_intent_id=full_intent;
  select effect.id into strict full_effect from public.payment_event_effects effect
  where effect.payment_intent_id=full_intent and effect.effect_type='accounting';
  select count(*) into outbox_count from public.payment_outbox where order_id=full_order;
  insert into public.after_sales(id,after_sale_no,tenant_id,mall_id,user_id,
    order_id,type,status,reason,requested_amount_cents,requested_by_membership_id,
    requested_by_member_id,order_status_before_request,migration_status)
  values(full_after_sale,'CONTRACT-INTENT-FULL-AS-'||suffix,'tenant-smart-wing',
    'mall-demo','user-test-storefront',full_order,'refund_only','approved',
    '单通道全额退款',100,'membership-test-storefront','member-test-storefront',
    'paid','ready');
  update public.orders target set status='refund_pending',updated_at=now()
  where target.id=full_order;
  result:=public.api_request_refund_authorized('user-test-owner',full_after_sale,100,
    'contract-intent-full-refund-'||suffix,'contract-intent-full-hash-'||suffix,
    'contract-intent-full-request-'||suffix,'contract',
    'membership-test-owner-admin',refund_evidence);
  perform public.process_payment_accounting_effect(full_effect);
  if result#>>'{refund,status}'<>'succeeded'
    or(select status from public.orders where id=full_order)<>'refunded'
    or(select status from public.payments where id=full_payment)<>'refunded'
    or not public.internal_payment_tender_valid(full_order,full_payment)
    or not public.internal_payment_intent_valid(full_intent)
    or(select count(*) from public.finance_journals
      where payment_intent_id=full_intent and journal_type='payment_capture')<>1
    or(select count(*) from public.fulfillment_orders
      where payment_intent_id=full_intent)<>1
    or(select count(*) from public.notification_dispatches
      where payment_intent_id=full_intent and refund_id is null)<>1
    or(select count(*) from public.payment_outbox where order_id=full_order)<>outbox_count
  then raise exception 'CONTRACT_INTERNAL_FULL_REFUND_INVALIDATED_CAPTURE'; end if;

  begin
    insert into public.payment_outbox(event_key,source,topic,order_id,
      payment_id,payment_intent_id,attempt_id,payload_json)
    select 'contract-invalid-anchor:'||suffix,'internal',
      'order.payment_succeeded',orders[1],payment.id,intent_id,null,'{}'
    from public.payments payment where payment.payment_intent_id=intent_id limit 1;
    raise exception 'CONTRACT_INTERNAL_FAKE_PAYMENT_ANCHOR_ACCEPTED';
  exception when check_violation then null; end;
  begin
    perform public.api_claim_payment_outbox('unknown','worker',1,30);
    raise exception 'CONTRACT_PAYMENT_OUTBOX_UNKNOWN_SOURCE_ACCEPTED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%PAYMENT_OUTBOX_WORKER_INVALID%' then raise; end if;
  end;
  if to_regclass('public.wechat_payment_outbox') is not null
    or has_table_privilege('service_role','public.payment_intents','select')
    or has_function_privilege('authenticated',
      'public.api_claim_payment_outbox(text,text,integer,integer)','execute')
  then raise exception 'CONTRACT_INTERNAL_PAYMENT_ACL_INVALID'; end if;
end $$;
rollback;
