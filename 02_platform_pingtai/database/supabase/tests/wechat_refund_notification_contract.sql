begin;

do $$
<<wechat_refund_notification_contract>>
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  order_id text:='refund-notification-order-'||suffix;
  payment_id text:='refund-notification-payment-'||suffix;
  after_sale_id text:='refund-notification-as-'||suffix;
  refund_id text:='refund-notification-refund-'||suffix;
  out_refund_no text:='WN'||upper(suffix);
  provider_refund_id text:='500000NOTIFY'||upper(suffix);
  identity_id uuid:=gen_random_uuid(); attempt_id uuid:=gen_random_uuid();
  result jsonb; duplicate_result jsonb; error_message text;
begin
  insert into public.orders(
    id,order_no,tenant_id,enterprise_id,mall_id,user_id,status,
    goods_amount_cents,discount_cents,payable_cents,paid_cents,
    recipient_snapshot_json,paid_at
  ) values(
    order_id,'REFUND-NOTIFICATION-'||suffix,'tenant-smart-wing','enterprise-demo',
    'mall-demo','user-test-storefront','refunded',1000,0,1000,1000,'{}',now()
  );
  insert into public.payments(
    id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,
    amount_cents,provider_trade_no,idempotency_key,completed_at
  ) values(
    payment_id,'REFUND-NOTIFICATION-PAY-'||suffix,'tenant-smart-wing','mall-demo',
    'user-test-storefront',order_id,'wechat','refunded',1000,
    '420000NOTIFY'||upper(suffix),'refund-notification-payment-'||suffix,now()
  );
  insert into public.member_wechat_identities(id,app_id,open_id)
  values(identity_id,'wxnotify'||suffix,'openid-notification-'||suffix);
  insert into public.wechat_payment_attempts(
    id,payment_id,order_id,identity_id,created_by_membership_id,app_id,mch_id,
    out_trade_no,description,amount_total,payer_openid_hash,status,
    transaction_id,provider_trade_state,completed_at
  ) values(
    attempt_id,payment_id,order_id,identity_id,'membership-test-storefront',
    'wxnotify'||suffix,'190000contract','RNT'||upper(suffix),'Refund notification contract',
    1000,repeat('3',64),'succeeded','420000NOTIFY'||upper(suffix),'SUCCESS',now()
  );
  insert into public.after_sales(
    id,after_sale_no,tenant_id,mall_id,user_id,order_id,type,status,reason,
    requested_amount_cents,requested_by_membership_id,requested_by_member_id,
    order_status_before_request,migration_status
  ) values(
    after_sale_id,'REFUND-NOTIFICATION-AS-'||suffix,'tenant-smart-wing','mall-demo',
    'user-test-storefront',order_id,'refund_only','completed','微信退款通知证据',
    1000,'membership-test-storefront','member-test-storefront','paid','ready'
  );
  insert into public.refunds(
    id,refund_no,tenant_id,mall_id,order_id,payment_id,amount_cents,status,
    reason,idempotency_key,completed_at
  ) values(
    refund_id,out_refund_no,'tenant-smart-wing','mall-demo',order_id,payment_id,
    1000,'succeeded','微信退款通知证据','refund-notification-'||suffix,now()
  );
  insert into public.wechat_refund_commands(
    tenant_id,mall_id,after_sale_id,order_id,payment_id,refund_id,payment_attempt_id,
    out_refund_no,out_trade_no,transaction_id,amount_cents,payment_total_cents,
    reason,next_operation,status,provider_status,provider_refund_id,
    completed_at,idempotency_key,request_hash
  ) values(
    'tenant-smart-wing','mall-demo',after_sale_id,order_id,payment_id,refund_id,attempt_id,
    out_refund_no,'RNT'||upper(suffix),'420000NOTIFY'||upper(suffix),1000,1000,
    '微信退款通知证据','query','succeeded','SUCCESS',provider_refund_id,now(),
    'refund-notification-'||suffix,'refund-notification-hash-'||suffix
  );
  set constraints all immediate; set constraints all deferred;

  result:=public.api_apply_wechat_refund_notification(
    'refund-notify-'||suffix,'REFUND.SUCCESS','encrypt-resource','190000contract',
    'RNT'||upper(suffix),'420000NOTIFY'||upper(suffix),out_refund_no,
    provider_refund_id,'SUCCESS',now(),1000,1000,800,900,
    jsonb_build_object('notification','verified','amountHasCurrency',false),
    'refund-notify-request-'||suffix
  );
  duplicate_result:=public.api_apply_wechat_refund_notification(
    'refund-notify-'||suffix,'REFUND.SUCCESS','encrypt-resource','190000contract',
    'RNT'||upper(suffix),'420000NOTIFY'||upper(suffix),out_refund_no,
    provider_refund_id,'SUCCESS',now(),1000,1000,800,900,
    jsonb_build_object('notification','verified','amountHasCurrency',false),
    'refund-notify-repeat-'||suffix
  );
  if result->>'duplicate'<>'false' or duplicate_result->>'duplicate'<>'true'
  then raise exception 'CONTRACT_REFUND_NOTIFICATION_DUPLICATE_INVALID'; end if;
  begin
    perform public.api_apply_wechat_refund_notification(
      'refund-notify-'||suffix,'REFUND.SUCCESS','encrypt-resource','190000contract',
      'RNT'||upper(suffix),'420000NOTIFY'||upper(suffix),out_refund_no,
      provider_refund_id,'SUCCESS',now(),1000,1000,800,900,
      jsonb_build_object('notification','tampered'),'refund-notify-tampered-'||suffix
    );
    raise exception 'CONTRACT_REFUND_NOTIFICATION_ID_REUSED_WITH_NEW_BODY';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%WECHAT_REFUND_NOTIFICATION_REPLAY_MISMATCH%' then raise; end if;
  end;
  begin
    perform public.api_apply_wechat_refund_notification(
      'refund-notify-conflict-'||suffix,'REFUND.CLOSED','encrypt-resource','190000contract',
      'RNT'||upper(suffix),'420000NOTIFY'||upper(suffix),out_refund_no,
      provider_refund_id,'CLOSED',null,1000,1000,800,900,
      jsonb_build_object('notification','conflict'),'refund-notify-conflict-'||suffix
    );
    raise exception 'CONTRACT_REFUND_TERMINAL_NOTIFICATION_REVERSED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%WECHAT_REFUND_TERMINAL_STATE_CONFLICT%' then raise; end if;
  end;
end wechat_refund_notification_contract;
$$;

rollback;
