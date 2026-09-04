-- Local timeout cannot prove that WeChat did not capture funds. Orders with a
-- provider attempt are releasable only after immutable terminal evidence.
create or replace function public.api_expire_due_checkout_orders(
  p_worker_id text,p_limit integer default 20
) returns table(order_id text,tenant_id text,mall_id text,
  expired_reservation_count integer,status text)
language plpgsql security definer set search_path=public,inventory,pg_temp as $$
declare candidate record; reservation_count integer;
begin
  if char_length(trim(coalesce(p_worker_id,''))) not between 1 and 120
    or p_limit is null or p_limit not between 1 and 100
  then raise exception 'CHECKOUT_EXPIRY_WORKER_INPUT_INVALID'; end if;
  for candidate in
    select orders.id,orders.tenant_id,orders.mall_id,orders.enterprise_id
    from public.orders orders
    where orders.status='pending_payment'
      and exists(select 1 from inventory.reservations reservation
        where reservation.tenant_id=orders.tenant_id
          and reservation.mall_id=orders.mall_id
          and reservation.order_id=orders.id and reservation.state='active'
          and reservation.expires_at<=clock_timestamp())
      and not exists(select 1 from inventory.reservations reservation
        where reservation.tenant_id=orders.tenant_id
          and reservation.mall_id=orders.mall_id
          and reservation.order_id=orders.id and reservation.state='active'
          and reservation.expires_at>clock_timestamp())
      and not exists(
        select 1 from public.wechat_payment_attempts attempt
        join public.payments payment on payment.id=attempt.payment_id
        where attempt.order_id=orders.id and(
          attempt.status not in('closed','failed')
          or payment.status not in('closed','failed')
          or not exists(select 1 from public.wechat_payment_observations evidence
            where evidence.attempt_id=attempt.id
              and evidence.trade_state in('CLOSED','REVOKED','PAYERROR')
              and evidence.outcome in('applied','recorded'))))
    order by(select min(reservation.expires_at)
      from inventory.reservations reservation
      where reservation.tenant_id=orders.tenant_id
        and reservation.mall_id=orders.mall_id
        and reservation.order_id=orders.id and reservation.state='active'),
      orders.id
    for update of orders skip locked limit p_limit
  loop
    select count(*) into reservation_count
    from inventory.reservations reservation
    where reservation.tenant_id=candidate.tenant_id
      and reservation.mall_id=candidate.mall_id
      and reservation.order_id=candidate.id and reservation.state='active';
    perform inventory.expire(candidate.tenant_id,candidate.mall_id,candidate.id,
      'checkout:expire:'||encode(digest(candidate.id,'sha256'),'hex'));
    update public.orders orders set status='cancelled',updated_at=now()
    where orders.id=candidate.id and orders.status='pending_payment';
    if not found then raise exception 'CHECKOUT_EXPIRY_ORDER_CHANGED'; end if;
    update public.sub_orders sub set status='cancelled',updated_at=now()
    where sub.tenant_id=candidate.tenant_id and sub.mall_id=candidate.mall_id
      and sub.parent_order_id=candidate.id;
    insert into public.audit_logs(id,tenant_id,enterprise_id,mall_id,actor_type,
      action,resource_type,resource_id,request_id,after_json,created_at)
    values(gen_random_uuid()::text,candidate.tenant_id,
      candidate.enterprise_id,candidate.mall_id,'system',
      'checkout.order.expired','order',candidate.id,
      'checkout-expiry:'||candidate.id,jsonb_build_object(
        'workerId',trim(p_worker_id),
        'expiredReservationCount',reservation_count),now());
    order_id:=candidate.id;tenant_id:=candidate.tenant_id;
    mall_id:=candidate.mall_id;
    expired_reservation_count:=reservation_count;status:='cancelled';
    return next;
  end loop;
end $$;

revoke all on function public.api_expire_due_checkout_orders(text,integer)
from public,anon,authenticated,service_role;
grant execute on function public.api_expire_due_checkout_orders(text,integer)
to service_role;
