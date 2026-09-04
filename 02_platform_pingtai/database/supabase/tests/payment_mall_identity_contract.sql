begin;

do $contract$
declare suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,10);
  mall_a text:='mall:payment-a:'||suffix;
  mall_b text:='mall:payment-b:'||suffix;
  intent_a text:='intent:payment-a:'||suffix;
  intent_b text:='intent:payment-b:'||suffix;
  provider_reference text:='provider:shared:'||suffix;
  application_a text:=repeat('a',64);
  application_b text:=repeat('b',64);
  resolved text;
begin
  insert into payment.intent(id,mall_id,order_id,member_id,currency,amount_minor,state,idempotency_key,provider_reference,expires_at,version)
  values
    (intent_a,mall_a,'missing-order-a:'||suffix,'member:a','CNY',100,'authorizing','idem:a:'||suffix,provider_reference,clock_timestamp()+interval '1 hour',0),
    (intent_b,mall_b,'missing-order-b:'||suffix,'member:b','CNY',100,'authorizing','idem:b:'||suffix,provider_reference,clock_timestamp()+interval '1 hour',0);
  insert into payment.attempt(id,mall_id,intent_id,tender_id,provider,state,requested_at,scene,application_hash)
  values
    ('attempt:a:'||suffix,mall_a,intent_a,'tender:wechat','wechat','started',clock_timestamp(),'miniapp',application_a),
    ('attempt:b:'||suffix,mall_b,intent_b,'tender:wechat','wechat','started',clock_timestamp(),'miniapp',application_b);

  select payment.webhook_scope('payment',provider_reference,application_a) into resolved;
  if resolved<>mall_a then raise exception 'PAYMENT_MALL_WEBHOOK_A_MISMATCH:%',resolved; end if;
  select payment.webhook_scope('payment',provider_reference,application_b) into resolved;
  if resolved<>mall_b then raise exception 'PAYMENT_MALL_WEBHOOK_B_MISMATCH:%',resolved; end if;

  begin
    insert into payment.attempt(id,mall_id,intent_id,tender_id,provider,state,requested_at,scene,application_hash)
    values('attempt:mismatch:'||suffix,mall_b,intent_a,'tender:wechat','wechat','started',clock_timestamp(),'miniapp',repeat('c',64));
    raise exception 'PAYMENT_MALL_COMPOSITE_FK_NOT_ENFORCED';
  exception when foreign_key_violation then null;
  end;

  insert into payment.payment(id,mall_id,intent_id,amount_minor,currency,captured_minor,refunded_minor,state,version)
  values('payment:a:'||suffix,mall_a,intent_a,100,'CNY',100,0,'captured',0);
  insert into payment.refund(id,mall_id,payment_id,provider,provider_reference,idempotency_key,amount_minor,currency,state,reason,version)
  values('refund:a:'||suffix,mall_a,'payment:a:'||suffix,'wechat','refund-provider:'||suffix,'refund-idem:'||suffix,100,'CNY','requested','contract',0);
  select payment.webhook_scope('refund','refund-provider:'||suffix,null) into resolved;
  if resolved<>mall_a then raise exception 'PAYMENT_MALL_REFUND_WEBHOOK_MISMATCH:%',resolved; end if;

  if exists(select 1 from ordering.orderrecord where id in('missing-order-a:'||suffix,'missing-order-b:'||suffix))
  then raise exception 'PAYMENT_MALL_CONTRACT_ACCIDENTALLY_CREATED_ORDER'; end if;
end $contract$;

rollback;
