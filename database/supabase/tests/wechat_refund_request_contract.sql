begin;

do $$
<<wechat_refund_request_contract>>
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  owner_session uuid:=gen_random_uuid(); owner_factor text:='refund-factor-'||suffix;
  owner_challenge text:='refund-stepup-'||suffix; verified_at timestamptz:=clock_timestamp();
  owner_authz integer; owner_credential integer; refund_evidence jsonb;
  order_ids text[]:=array['refund-request-success-'||suffix,'refund-request-guard-'||suffix];
  payment_ids text[]:=array['refund-request-success-pay-'||suffix,'refund-request-guard-pay-'||suffix];
  after_sale_ids text[]:=array['refund-request-success-as-'||suffix,'refund-request-guard-as-'||suffix];
  identity_ids uuid[]:=array[gen_random_uuid(),gen_random_uuid()];
  attempt_ids uuid[]:=array[gen_random_uuid(),gen_random_uuid()];
  capture_event uuid; capture_inbox uuid; capture_effect uuid; capture_journal uuid;
  ordinal integer; result jsonb; duplicate_result jsonb; error_message text;
begin
  insert into public.role_permissions(role_id,permission_id)
  select 'role-platform-owner-v2',permission.id from public.permissions permission
  where permission.code='order.refund' on conflict do nothing;
  select membership.authz_version,coalesce(credential.credential_version,0)
  into strict owner_authz,owner_credential from public.memberships membership
  left join public.member_credentials credential on credential.member_id=membership.member_id
  where membership.id='membership-test-owner-admin';
  insert into public.auth_sessions(
    id,member_id,membership_id,target,credential_version,ip_hash,
    user_agent,device_label,expires_at
  ) values(
    owner_session,'member-test-owner','membership-test-owner-admin','admin',
    owner_credential,'refund-request','refund-request','refund-request',now()+interval '1 hour'
  );
  insert into public.admin_mfa_factors(
    id,tenant_id,user_id,factor_type,secret_ciphertext,label,status
  ) values(
    owner_factor,'tenant-smart-wing','user-test-owner','totp',repeat('a',32),
    'Refund request contract','active'
  ) on conflict(user_id,factor_type) do update set status='active' returning id into owner_factor;
  insert into public.admin_step_up_challenges(
    id,membership_id,user_id,session_id,factor_id,status,attempts,
    request_id,created_at,expires_at,verified_at,updated_at
  ) values(
    owner_challenge,'membership-test-owner-admin','user-test-owner',owner_session::text,
    owner_factor,'verified',0,'refund-request-stepup-'||suffix,verified_at,
    verified_at+interval '5 minutes',verified_at,verified_at
  );
  refund_evidence:=jsonb_build_object(
    'sessionId',owner_session,'membershipId','membership-test-owner-admin',
    'authzVersion',owner_authz,'permission','order.refund','stepUpAt',verified_at
  );

  for ordinal in 1..2 loop
    insert into public.orders(
      id,order_no,tenant_id,enterprise_id,mall_id,user_id,status,
      goods_amount_cents,discount_cents,payable_cents,paid_cents,
      recipient_snapshot_json,paid_at
    ) values(
      order_ids[ordinal],'REFUND-REQUEST-'||ordinal||'-'||suffix,'tenant-smart-wing',
      'enterprise-demo','mall-demo','user-test-storefront','refund_pending',
      1000,0,1000,1000,'{}',now()
    );
    insert into public.payments(
      id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,
      amount_cents,provider_trade_no,idempotency_key,completed_at
    ) values(
      payment_ids[ordinal],'REFUND-REQUEST-PAY-'||ordinal||'-'||suffix,
      'tenant-smart-wing','mall-demo','user-test-storefront',order_ids[ordinal],
      'wechat','succeeded',1000,'420000REQUEST'||ordinal||upper(suffix),
      'refund-request-payment-'||ordinal||'-'||suffix,now()
    );
    insert into public.member_wechat_identities(id,app_id,open_id)
    values(identity_ids[ordinal],'wxrequest'||ordinal||suffix,'openid-request-'||ordinal||'-'||suffix);
    insert into public.wechat_payment_attempts(
      id,payment_id,order_id,identity_id,created_by_membership_id,app_id,
      mch_id,out_trade_no,description,amount_total,payer_openid_hash,
      status,transaction_id,provider_trade_state,completed_at
    ) values(
      attempt_ids[ordinal],payment_ids[ordinal],order_ids[ordinal],identity_ids[ordinal],
      'membership-test-storefront','wxrequest'||ordinal||suffix,'190000contract',
      'RRQ'||ordinal||upper(suffix),'Refund request contract',1000,repeat(ordinal::text,64),
      'succeeded','420000REQUEST'||ordinal||upper(suffix),'SUCCESS',now()
    );
    insert into public.after_sales(
      id,after_sale_no,tenant_id,mall_id,user_id,order_id,type,status,reason,
      requested_amount_cents,requested_by_membership_id,requested_by_member_id,
      order_status_before_request,migration_status
    ) values(
      after_sale_ids[ordinal],'REFUND-REQUEST-AS-'||ordinal||'-'||suffix,
      'tenant-smart-wing','mall-demo','user-test-storefront',order_ids[ordinal],
      'refund_only',case when ordinal=2 then 'submitted' else 'approved' end,
      '经审批的微信退款请求契约',1000,'membership-test-storefront',
      'member-test-storefront','paid','ready'
    );
    if ordinal=1 then
      capture_event:=gen_random_uuid(); capture_effect:=gen_random_uuid();
      insert into public.payment_outbox(
        id,event_key,source,topic,order_id,payment_id,payment_intent_id,
        attempt_id,payload_json,status,delivered_at
      ) values(
        capture_event,'refund-request-capture:'||suffix,'wechat','order.payment_succeeded',
        order_ids[ordinal],payment_ids[ordinal],null,attempt_ids[ordinal],
        jsonb_build_object('orderId',order_ids[ordinal]),'delivered',now()
      );
      insert into public.payment_event_inbox(
        outbox_id,event_key,tenant_id,aggregate_id,aggregate_version,
        event_type,payload_digest,consumer
      ) select id,event_key,tenant_id,aggregate_id,aggregate_version,event_type,
        encode(digest(event_key,'sha256'),'hex'),'refund-request-contract'
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
    end if;
  end loop;
  set constraints all immediate; set constraints all deferred;

  begin
    perform public.api_request_refund_authorized(
      'user-test-owner',after_sale_ids[2],1000,'guard-unapproved-'||suffix,
      'guard-unapproved-hash-'||suffix,'guard-unapproved-request','contract',
      'membership-test-owner-admin',refund_evidence
    );
    raise exception 'CONTRACT_REFUND_UNAPPROVED_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%AFTER_SALE_NOT_APPROVED%' then raise; end if;
  end;
  update public.after_sales set status='approved',type='return_refund'
  where id=after_sale_ids[2];
  begin
    perform public.api_request_refund_authorized(
      'user-test-owner',after_sale_ids[2],1000,'guard-return-'||suffix,
      'guard-return-hash-'||suffix,'guard-return-request','contract',
      'membership-test-owner-admin',refund_evidence
    );
    raise exception 'CONTRACT_REFUND_RETURN_WITHOUT_RECEIPT_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%AFTER_SALE_NOT_REFUNDABLE%' then raise; end if;
  end;
  update public.after_sales set type='refund_only' where id=after_sale_ids[2];
  begin
    perform public.api_request_refund_authorized(
      'user-test-owner',after_sale_ids[2],1000,'guard-capture-'||suffix,
      'guard-capture-hash-'||suffix,'guard-capture-request','contract',
      'membership-test-owner-admin',refund_evidence
    );
    raise exception 'CONTRACT_REFUND_BEFORE_CAPTURE_ACCOUNTING_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%PAYMENT_ACCOUNTING_PENDING%' then raise; end if;
  end;
  insert into public.payments(
    id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,
    amount_cents,idempotency_key,completed_at
  ) values(
    'refund-request-mixed-'||suffix,'REFUND-REQUEST-MIXED-'||suffix,
    'tenant-smart-wing','mall-demo','user-test-storefront',order_ids[2],
    'welfare','succeeded',100,'refund-request-mixed-'||suffix,now()
  );
  begin
    perform public.api_request_refund_authorized(
      'user-test-owner',after_sale_ids[2],1000,'guard-mixed-'||suffix,
      'guard-mixed-hash-'||suffix,'guard-mixed-request','contract',
      'membership-test-owner-admin',refund_evidence
    );
    raise exception 'CONTRACT_REFUND_MIXED_ALLOCATION_GUESSED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%REFUND_ALLOCATION_RULE_REQUIRED%' then raise; end if;
  end;
  if exists(select 1 from public.wechat_refund_commands command
    where command.after_sale_id=after_sale_ids[2])
  then raise exception 'CONTRACT_REFUND_GUARD_MUTATED_MONEY_STATE'; end if;

  result:=public.api_request_refund_authorized(
    'user-test-owner',after_sale_ids[1],1000,'refund-success-'||suffix,
    'refund-success-hash-'||suffix,'refund-success-request','contract',
    'membership-test-owner-admin',refund_evidence
  );
  duplicate_result:=public.api_request_refund_authorized(
    'user-test-owner',after_sale_ids[1],1000,'refund-success-'||suffix,
    'refund-success-hash-'||suffix,'refund-success-replay','contract',
    'membership-test-owner-admin',refund_evidence
  );
  if result<>duplicate_result or result#>>'{refund,status}'<>'processing'
  then raise exception 'CONTRACT_REFUND_REQUEST_NOT_IDEMPOTENT'; end if;
  begin
    perform public.api_request_refund_authorized(
      'user-test-owner',after_sale_ids[1],900,'refund-success-'||suffix,
      'refund-success-hash-'||suffix,'refund-success-conflict','contract',
      'membership-test-owner-admin',refund_evidence
    );
    raise exception 'CONTRACT_REFUND_SAME_HASH_DIFFERENT_AMOUNT_REPLAYED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%IDEMPOTENCY_CONFLICT%' then raise; end if;
  end;
  if (select count(*) from public.wechat_refund_commands command
    where command.after_sale_id=after_sale_ids[1])<>1
  then raise exception 'CONTRACT_REFUND_CONFLICT_MUTATED_COMMANDS'; end if;
end wechat_refund_request_contract;
$$;

rollback;
