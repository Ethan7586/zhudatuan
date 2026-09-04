-- A signed provider response and its lease acknowledgement commit together.
-- The order-first lock helper is defined with the queue in 127600.

create function public.api_record_wechat_payment_query_result(
  p_attempt_id uuid,p_worker_id text,p_lease_token uuid,p_app_id text,
  p_mch_id text,p_out_trade_no text,p_transaction_id text,p_trade_state text,
  p_success_time timestamptz,p_amount_total bigint,p_payer_openid_hash text,
  p_evidence_json jsonb
) returns jsonb language plpgsql security definer
set search_path=public,inventory,pg_temp as $$
declare current_attempt public.wechat_payment_attempts%rowtype;
  observation jsonb; query_key text; result_status text; result_outcome text;
  next_operation text;
begin
  current_attempt:=public.lock_wechat_payment_query(
    p_attempt_id,p_worker_id,p_lease_token);
  if current_attempt.id is null then
    return jsonb_build_object('accepted',false,'status','lease_lost');
  end if;
  if current_attempt.query_operation<>'query'
  then raise exception 'PAYMENT_QUERY_OPERATION_MISMATCH'; end if;
  if current_attempt.app_id<>p_app_id or current_attempt.mch_id<>p_mch_id
    or current_attempt.out_trade_no<>p_out_trade_no
    or current_attempt.amount_total<>p_amount_total
  then
    return public.api_fail_wechat_payment_query(p_attempt_id,p_worker_id,
      p_lease_token,'PAYMENT_QUERY_EVIDENCE_MISMATCH',false);
  end if;
  query_key:='payment-query:'||p_attempt_id||':'||p_lease_token;
  observation:=public.api_apply_wechat_payment_query(
    query_key,p_app_id,p_mch_id,p_out_trade_no,
    coalesce(p_transaction_id,''),p_trade_state,p_success_time,
    p_amount_total,p_payer_openid_hash,coalesce(p_evidence_json,'{}'::jsonb),
    query_key);
  result_outcome:=observation->>'outcome';
  if result_outcome='rejected' then
    return public.api_fail_wechat_payment_query(p_attempt_id,p_worker_id,
      p_lease_token,'PAYMENT_QUERY_EVIDENCE_REJECTED',false);
  end if;
  select * into current_attempt from public.wechat_payment_attempts
  where id=p_attempt_id;
  result_status:=case
    when current_attempt.status='succeeded' then 'succeeded'
    when current_attempt.status in('closed','failed') then 'terminal'
    else 'pending' end;
  next_operation:=case when result_status='pending'
      and p_trade_state='NOTPAY'
      and(current_attempt.close_requested_at is null
        or current_attempt.close_requested_at<=now()-interval '60 seconds')
      and exists(select 1 from inventory.reservations reservation
        where reservation.order_id=current_attempt.order_id
          and reservation.state='active'
          and reservation.expires_at<=now())
      and not exists(select 1 from inventory.reservations reservation
        where reservation.order_id=current_attempt.order_id
          and reservation.state='active'
          and reservation.expires_at>now())
    then 'close' else 'query' end;
  update public.wechat_payment_attempts set query_attempts=0,
    query_operation=next_operation,
    query_available_at=case when result_status='pending'
      then now()+case when next_operation='close' then interval '1 second'
        when status='processing' then interval '15 seconds'
        else interval '60 seconds' end else query_available_at end,
    query_locked_by=null,query_locked_at=null,query_lease_token=null,
    query_lease_expires_at=null,query_dead_lettered_at=null,
    query_last_error_code=null,updated_at=now()
  where id=current_attempt.id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_type,
    action,resource_type,resource_id,request_id,after_json,created_at)
  select gen_random_uuid()::text,orders.tenant_id,orders.enterprise_id,
    orders.mall_id,'system','payment.query.observed','payment_attempt',
    current_attempt.id::text,query_key,jsonb_build_object(
      'tradeState',p_trade_state,'outcome',result_outcome,
      'status',result_status),now()
  from public.orders orders where orders.id=current_attempt.order_id;
  return jsonb_build_object('accepted',true,'status',result_status,
    'outcome',result_outcome,'attempts',current_attempt.query_attempts);
end $$;

create function public.api_record_wechat_payment_close_accepted(
  p_attempt_id uuid,p_worker_id text,p_lease_token uuid,
  p_provider_request_id text
) returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare attempt public.wechat_payment_attempts%rowtype;
begin
  if length(coalesce(p_provider_request_id,''))>128
  then raise exception 'PAYMENT_CLOSE_RESULT_INVALID'; end if;
  attempt:=public.lock_wechat_payment_query(
    p_attempt_id,p_worker_id,p_lease_token);
  if attempt.id is null then
    return jsonb_build_object('accepted',false,'status','lease_lost');
  end if;
  if attempt.query_operation<>'close'
  then raise exception 'PAYMENT_CLOSE_OPERATION_MISMATCH'; end if;
  update public.wechat_payment_attempts set query_attempts=0,
    query_operation='query',query_available_at=now()+interval '5 seconds',
    query_locked_by=null,query_locked_at=null,query_lease_token=null,
    query_lease_expires_at=null,query_last_error_code=null,
    close_requested_at=now(),close_request_count=close_request_count+1,
    updated_at=now() where id=attempt.id;
  insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_type,
    action,resource_type,resource_id,request_id,after_json,created_at)
  select gen_random_uuid()::text,orders.tenant_id,orders.enterprise_id,
    orders.mall_id,'system','payment.close.accepted','payment_attempt',
    attempt.id::text,'payment-close:'||attempt.id||':'||p_lease_token,
    jsonb_build_object('providerAccepted',true,
      'providerRequestId',nullif(p_provider_request_id,'')),now()
  from public.orders orders where orders.id=attempt.order_id;
  return jsonb_build_object('accepted',true,'status','pending',
    'attempts',attempt.query_attempts,'outcome','close_accepted');
end $$;

revoke all on function public.api_record_wechat_payment_query_result(
  uuid,text,uuid,text,text,text,text,text,timestamptz,bigint,text,jsonb),
  public.api_record_wechat_payment_close_accepted(uuid,text,uuid,text),
  public.lock_wechat_payment_query(uuid,text,uuid)
from public,anon,authenticated;
grant execute on function public.api_record_wechat_payment_query_result(
  uuid,text,uuid,text,text,text,text,text,timestamptz,bigint,text,jsonb),
  public.api_record_wechat_payment_close_accepted(uuid,text,uuid,text)
to service_role;
