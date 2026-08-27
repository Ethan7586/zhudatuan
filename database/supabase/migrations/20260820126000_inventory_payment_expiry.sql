-- Couple money state and the authoritative reservation ledger without making
-- provider evidence depend on inventory success.  Every path locks an order
-- before inventory rows so checkout, payment, terminal events and expiry use
-- one lock order.

create or replace function inventory.commit_payment(
  p_tenant_id text,
  p_mall_id text,
  p_order_id text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path=inventory,public,pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_response jsonb;
  v_active integer;
  v_committed integer;
begin
  select * into v_order from public.orders orders
  where orders.id=p_order_id for update;
  if not found or v_order.tenant_id<>p_tenant_id or v_order.mall_id<>p_mall_id
  then raise exception 'INVENTORY_PAYMENT_ORDER_NOT_FOUND'; end if;
  if v_order.status<>'paid' or v_order.paid_cents<>v_order.payable_cents
     or v_order.paid_at is null
  then raise exception 'INVENTORY_PAYMENT_ORDER_STATE_INVALID'; end if;

  -- Match the primitive's fixed order: order, sorted stock, sorted
  -- reservations.  Re-locking these rows inside inventory.commit is reentrant
  -- and leaves no wait between the expiry check and the state transition.
  perform stock.id from inventory.stock_items stock
  join inventory.reservations reservation on reservation.stock_item_id=stock.id
  where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id
    and reservation.order_id=p_order_id
  order by stock.sku_id,stock.location_id,stock.id for update of stock;
  perform reservation.id from inventory.reservations reservation
  where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id
    and reservation.order_id=p_order_id
  order by reservation.sku_id,reservation.location_id,reservation.id for update;
  if not exists(
    select 1 from inventory.reservations reservation
    where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id
      and reservation.order_id=p_order_id
  ) then raise exception 'INVENTORY_PAYMENT_RESERVATION_MISSING'; end if;
  if exists(
    select 1 from inventory.reservations reservation
    where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id
      and reservation.order_id=p_order_id
      and reservation.state in ('released','expired')
  ) then raise exception 'INVENTORY_PAYMENT_RESERVATION_TERMINAL'; end if;
  if exists(
    select 1 from inventory.reservations reservation
    where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id
      and reservation.order_id=p_order_id and reservation.state='active'
      and reservation.expires_at<=clock_timestamp()
  ) then raise exception 'INVENTORY_PAYMENT_RESERVATION_EXPIRED'; end if;
  select count(*) filter(where state='active'),count(*) filter(where state='committed')
  into v_active,v_committed from inventory.reservations reservation
  where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id
    and reservation.order_id=p_order_id;
  if v_committed>0
  then raise exception 'INVENTORY_PAYMENT_RESERVATION_ALREADY_COMMITTED'; end if;
  if v_active=0
  then raise exception 'INVENTORY_PAYMENT_RESERVATION_MISSING'; end if;
  if exists(
    with expected as (
      select item.sku_id,sum(item.quantity)::bigint quantity
      from public.order_items item where item.order_id=p_order_id group by item.sku_id
    ), actual as (
      select reservation.sku_id,sum(reservation.quantity)::bigint quantity
      from inventory.reservations reservation
      where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id
        and reservation.order_id=p_order_id group by reservation.sku_id
    )
    select 1 from expected full join actual using(sku_id)
    where expected.quantity is distinct from actual.quantity
  ) then raise exception 'INVENTORY_PAYMENT_RESERVATION_ITEMS_MISMATCH'; end if;

  v_response:=inventory.commit(
    p_tenant_id,p_mall_id,p_order_id,p_idempotency_key
  );
  if exists(
    select 1 from inventory.reservations reservation
    where reservation.tenant_id=p_tenant_id and reservation.mall_id=p_mall_id
      and reservation.order_id=p_order_id and reservation.state<>'committed'
  ) then raise exception 'INVENTORY_PAYMENT_COMMIT_INCOMPLETE'; end if;
  return v_response;
end;
$$;

revoke all on function inventory.commit_payment(text,text,text,text)
from public,anon,authenticated,service_role;

create or replace function public.api_pay_internal_authorized(
  p_tenant_id text,p_enterprise_id text,p_mall_id text,p_user_id text,
  p_order_id text,p_welfare_cents bigint,p_meal_cents bigint,
  p_idempotency_key text,p_request_hash text,p_request_id text,p_user_agent text,
  p_membership_id text,p_granted_via jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,inventory,pg_temp as $$
declare
  v_existing public.idempotency_keys%rowtype;
  v_order public.orders%rowtype;
  v_account public.welfare_accounts%rowtype;
  v_channel text;
  v_amount bigint;
  v_payment_id text;
  v_payment_no text;
  v_payment_nos jsonb:='[]'::jsonb;
  v_inventory jsonb;
  v_now timestamptz:=clock_timestamp();
  v_response jsonb;
  v_changed integer;
  v_existing_welfare bigint;
  v_existing_meal bigint;
  v_existing_tenders integer;
begin
  if char_length(trim(coalesce(p_idempotency_key,''))) not between 1 and 120
     or p_request_hash !~ '^[A-Za-z0-9+/]{43}=$'
     or char_length(trim(coalesce(p_request_id,''))) not between 1 and 160
     or p_welfare_cents<0 or p_meal_cents<0
  then raise exception 'INTERNAL_PAYMENT_INPUT_INVALID'; end if;
  if not public.api_lock_membership_actor(
       p_membership_id,p_user_id,'storefront',p_tenant_id,p_enterprise_id,p_mall_id
     )
     or not exists(
       select 1 from public.membership_scopes scope
       where scope.membership_id=p_membership_id and scope.scope_kind='self'
         and scope.resource_id=p_user_id
     )
     or not public.api_membership_has_permission(p_membership_id,'order.create')
     or not public.api_authorization_evidence_matches(
       p_granted_via,p_membership_id,'order.create',false
     )
  then raise exception 'INTERNAL_PAYMENT_ACTOR_NOT_AUTHORIZED'; end if;
  if not public.api_member_phone_verified(p_membership_id,p_user_id)
  then raise exception 'PHONE_VERIFICATION_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id||':'||p_mall_id||':payment:internal:'||trim(p_idempotency_key),0
  ));
  select * into v_existing from public.idempotency_keys idempotency
  where idempotency.tenant_id=p_tenant_id and idempotency.mall_id=p_mall_id
    and idempotency.scope='payment:internal'
    and idempotency.idempotency_key=trim(p_idempotency_key)
    and idempotency.expires_at>now();
  if found then
    select coalesce(sum(payment.amount_cents)
        filter(where payment.channel='welfare'),0),
      coalesce(sum(payment.amount_cents)
        filter(where payment.channel='meal'),0),count(*)
    into v_existing_welfare,v_existing_meal,v_existing_tenders
    from public.payments payment where payment.order_id=p_order_id
      and payment.channel in('welfare','meal')
      and payment.status in('succeeded','refunded');
    if v_existing.request_hash is distinct from p_request_hash
      or v_existing.resource_id is distinct from p_order_id
      or not exists(select 1 from public.orders orders where orders.id=p_order_id
        and orders.tenant_id=p_tenant_id
        and orders.enterprise_id=p_enterprise_id and orders.mall_id=p_mall_id
        and orders.user_id=p_user_id)
      or v_existing_welfare<>p_welfare_cents
      or v_existing_meal<>p_meal_cents
      or v_existing_tenders<>(case when p_welfare_cents>0 then 1 else 0 end
        +case when p_meal_cents>0 then 1 else 0 end)
      or exists(select 1 from public.payments payment
        where payment.order_id=p_order_id
          and payment.channel not in('welfare','meal'))
    then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'payment-order:'||p_order_id,0
  ));
  select * into v_order from public.orders orders
  where orders.id=p_order_id and orders.tenant_id=p_tenant_id
    and orders.enterprise_id=p_enterprise_id and orders.mall_id=p_mall_id
    and orders.user_id=p_user_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status<>'pending_payment' or v_order.paid_cents<>0
  then raise exception 'ORDER_NOT_PAYABLE'; end if;
  if p_welfare_cents+p_meal_cents<>v_order.payable_cents
  then raise exception 'PAYMENT_TOTAL_MISMATCH'; end if;

  for v_channel,v_amount in
    select * from (values('welfare',p_welfare_cents),('meal',p_meal_cents))
      requested(channel,amount) where amount>0
  loop
    select * into v_account from public.welfare_accounts account
    where account.tenant_id=p_tenant_id and account.enterprise_id=p_enterprise_id
      and account.mall_id=p_mall_id and account.user_id=p_user_id
      and account.account_type=v_channel for update;
    if not found or v_account.status<>'active'
    then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
    update public.welfare_accounts set
      balance_cents=balance_cents-v_amount,version=version+1,updated_at=v_now
    where id=v_account.id and balance_cents>=v_amount and status='active';
    get diagnostics v_changed=row_count;
    if v_changed<>1 then raise exception 'INSUFFICIENT_ACCOUNT_BALANCE'; end if;
    v_payment_id:=gen_random_uuid()::text;
    v_payment_no:='PAY'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')
      ||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    insert into public.account_ledgers (
      id,tenant_id,mall_id,account_id,user_id,direction,amount_cents,
      balance_after_cents,business_type,business_id,idempotency_key,created_at
    ) select gen_random_uuid()::text,p_tenant_id,p_mall_id,v_account.id,p_user_id,
      'debit',v_amount,balance_cents,'order_payment',p_order_id,
      trim(p_idempotency_key)||':'||v_channel,v_now
    from public.welfare_accounts where id=v_account.id;
    insert into public.payments (
      id,payment_no,tenant_id,mall_id,user_id,order_id,channel,status,
      amount_cents,idempotency_key,created_at,completed_at
    ) values (
      v_payment_id,v_payment_no,p_tenant_id,p_mall_id,p_user_id,p_order_id,
      v_channel,'succeeded',v_amount,trim(p_idempotency_key)||':'||v_channel,v_now,v_now
    );
    insert into public.payment_allocations (
      id,tenant_id,mall_id,payment_id,order_id,account_id,channel,amount_cents
    ) values (
      gen_random_uuid()::text,p_tenant_id,p_mall_id,v_payment_id,p_order_id,
      v_account.id,v_channel,v_amount
    );
    v_payment_nos:=v_payment_nos||jsonb_build_array(v_payment_no);
  end loop;

  update public.orders set paid_cents=payable_cents,status='paid',paid_at=v_now,
    updated_at=v_now where id=p_order_id;
  v_inventory:=inventory.commit_payment(
    p_tenant_id,p_mall_id,p_order_id,'payment:internal:'||trim(p_idempotency_key)
  );
  update public.sub_orders set status='paid',updated_at=v_now
  where tenant_id=p_tenant_id and mall_id=p_mall_id and parent_order_id=p_order_id;
  v_response:=jsonb_build_object(
    'payment',jsonb_build_object(
      'orderId',p_order_id,'orderNo',v_order.order_no,'paymentNos',v_payment_nos,
      'status','succeeded','amountCents',v_order.payable_cents,'completedAt',v_now
    ),'inventoryReservation',v_inventory,'requestId',p_request_id
  );
  insert into public.idempotency_keys (
    tenant_id,mall_id,scope,idempotency_key,request_hash,resource_id,
    response_json,created_at,expires_at
  ) values (
    p_tenant_id,p_mall_id,'payment:internal',trim(p_idempotency_key),p_request_hash,
    p_order_id,v_response,v_now,v_now+interval '24 hours'
  );
  insert into public.audit_logs (
    id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,
    resource_type,resource_id,request_id,user_agent,after_json,
    membership_id,granted_via,created_at
  ) values (
    gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_user_id,'user',
    'payment.internal.succeeded','order',p_order_id,p_request_id,
    left(coalesce(p_user_agent,''),300),jsonb_build_object(
      'amountCents',v_order.payable_cents,'paymentNos',v_payment_nos,
      'inventoryCommitted',true
    ),p_membership_id,p_granted_via,v_now
  );
  insert into public.audit_logs (
    id,tenant_id,enterprise_id,mall_id,actor_user_id,actor_type,action,
    resource_type,resource_id,request_id,user_agent,after_json,
    membership_id,granted_via,created_at
  ) values (
    gen_random_uuid()::text,p_tenant_id,p_enterprise_id,p_mall_id,p_user_id,'user',
    'payment.internal.authorized','order',p_order_id,p_request_id,
    left(coalesce(p_user_agent,''),300),
    jsonb_build_object('idempotencyKey',trim(p_idempotency_key)),
    p_membership_id,p_granted_via,v_now
  );
  return v_response;
end;
$$;

drop function if exists public.api_pay_internal(
  text,text,text,text,text,bigint,bigint,text,text,text,text
);
revoke all on function public.api_pay_internal_authorized(
  text,text,text,text,text,bigint,bigint,text,text,text,text,text,jsonb
) from public,anon,authenticated,service_role;
grant execute on function public.api_pay_internal_authorized(
  text,text,text,text,text,bigint,bigint,text,text,text,text,text,jsonb
) to service_role;
