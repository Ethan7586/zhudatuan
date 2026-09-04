alter table public.users
  drop constraint users_tenant_id_identity_subject_key;
alter table public.users
  add constraint users_tenant_id_identity_subject_key
  unique (tenant_id, identity_subject);

create or replace function public.api_pay_internal(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_order_id text, p_welfare_cents bigint, p_meal_cents bigint,
  p_idempotency_key text, p_request_hash text, p_request_id text, p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.idempotency_keys%rowtype;
  v_order public.orders%rowtype;
  v_account public.welfare_accounts%rowtype;
  v_channel text;
  v_amount bigint;
  v_payment_id text;
  v_payment_no text;
  v_payment_nos jsonb := '[]'::jsonb;
  v_now timestamptz := clock_timestamp();
  v_response jsonb;
  v_changed integer;
begin
  select * into v_existing from public.idempotency_keys
  where mall_id = p_mall_id and scope = 'payment:internal'
    and idempotency_key = p_idempotency_key and expires_at > now();
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;

  select * into v_order from public.orders
  where tenant_id = p_tenant_id and enterprise_id = p_enterprise_id
    and mall_id = p_mall_id and user_id = p_user_id and id = p_order_id
  for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'pending_payment' or v_order.paid_cents <> 0 then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;
  if p_welfare_cents < 0 or p_meal_cents < 0
     or p_welfare_cents + p_meal_cents <> v_order.payable_cents then
    raise exception 'PAYMENT_TOTAL_MISMATCH';
  end if;

  for v_channel, v_amount in
    select * from (values ('welfare', p_welfare_cents), ('meal', p_meal_cents)) x(channel, amount)
    where amount > 0
  loop
    select * into v_account from public.welfare_accounts
    where tenant_id = p_tenant_id and enterprise_id = p_enterprise_id
      and mall_id = p_mall_id and user_id = p_user_id and account_type = v_channel
    for update;
    if not found or v_account.status <> 'active' then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
    update public.welfare_accounts
      set balance_cents = balance_cents - v_amount, version = version + 1, updated_at = v_now
    where id = v_account.id and balance_cents >= v_amount and status = 'active';
    get diagnostics v_changed = row_count;
    if v_changed <> 1 then raise exception 'INSUFFICIENT_ACCOUNT_BALANCE'; end if;

    v_payment_id := gen_random_uuid()::text;
    v_payment_no := 'PAY' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') ||
                    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    insert into public.account_ledgers (
      id, tenant_id, mall_id, account_id, user_id, direction, amount_cents,
      balance_after_cents, business_type, business_id, idempotency_key, created_at
    ) select gen_random_uuid()::text, p_tenant_id, p_mall_id, v_account.id, p_user_id,
      'debit', v_amount, balance_cents, 'order_payment', p_order_id,
      p_idempotency_key || ':' || v_channel, v_now
      from public.welfare_accounts where id = v_account.id;
    insert into public.payments (
      id, payment_no, tenant_id, mall_id, user_id, order_id, channel, status,
      amount_cents, idempotency_key, created_at, completed_at
    ) values (
      v_payment_id, v_payment_no, p_tenant_id, p_mall_id, p_user_id,
      p_order_id, v_channel, 'succeeded', v_amount,
      p_idempotency_key || ':' || v_channel, v_now, v_now
    );
    insert into public.payment_allocations (
      id, tenant_id, mall_id, payment_id, order_id, account_id, channel, amount_cents
    ) values (
      gen_random_uuid()::text, p_tenant_id, p_mall_id, v_payment_id, p_order_id,
      v_account.id, v_channel, v_amount
    );
    v_payment_nos := v_payment_nos || jsonb_build_array(v_payment_no);
  end loop;

  update public.orders set paid_cents = payable_cents, status = 'paid',
    paid_at = v_now, updated_at = v_now where id = p_order_id;
  update public.sub_orders set status = 'paid', updated_at = v_now
    where tenant_id = p_tenant_id and mall_id = p_mall_id and parent_order_id = p_order_id;

  v_response := jsonb_build_object('payment', jsonb_build_object(
    'orderId', p_order_id, 'orderNo', v_order.order_no, 'paymentNos', v_payment_nos,
    'status', 'succeeded', 'amountCents', v_order.payable_cents, 'completedAt', v_now
  ), 'requestId', p_request_id);
  insert into public.idempotency_keys values (
    p_tenant_id, p_mall_id, 'payment:internal', p_idempotency_key, p_request_hash,
    p_order_id, v_response, v_now, v_now + interval '24 hours'
  );
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json, created_at
  ) values (
    gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id,
    'user', 'payment.internal.succeeded', 'order', p_order_id, p_request_id,
    left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('amountCents', v_order.payable_cents, 'paymentNos', v_payment_nos), v_now
  );
  return v_response;
end;
$$;

revoke all on function public.api_pay_internal(
  text,text,text,text,text,bigint,bigint,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.api_pay_internal(
  text,text,text,text,text,bigint,bigint,text,text,text,text
) to service_role;
