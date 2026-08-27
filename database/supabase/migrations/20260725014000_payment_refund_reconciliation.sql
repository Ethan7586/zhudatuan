-- Internal-account payment hardening: serialized idempotency, auditable refunds,
-- and a read-only reconciliation report. External payment gateways remain out of scope.

create index if not exists idx_refunds_payment_status
  on public.refunds (payment_id, status);

insert into public.permissions (id, code, name) values
  ('permission-finance-refund', 'finance:refund', '执行内部账户退款'),
  ('permission-finance-reconcile', 'finance:reconcile', '查看财务对账报告')
on conflict (code) do update set name = excluded.name;

insert into public.role_permissions (role_id, permission_id) values
  ('role-mall-admin', 'permission-finance-refund'),
  ('role-mall-admin', 'permission-finance-reconcile')
on conflict do nothing;

create or replace function public.api_pay_internal(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_order_id text, p_welfare_cents bigint, p_meal_cents bigint,
  p_idempotency_key text, p_request_hash text, p_request_id text, p_user_agent text
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_existing public.idempotency_keys%rowtype; v_order public.orders%rowtype;
  v_account public.welfare_accounts%rowtype; v_channel text; v_amount bigint;
  v_payment_id text; v_payment_no text; v_payment_nos jsonb := '[]'::jsonb;
  v_now timestamptz := clock_timestamp(); v_response jsonb; v_changed integer;
begin
  if length(trim(coalesce(p_idempotency_key, ''))) = 0 or length(p_idempotency_key) > 120 then
    raise exception 'IDEMPOTENCY_KEY_INVALID';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_mall_id || ':payment:internal:' || p_idempotency_key));
  select * into v_existing from public.idempotency_keys where mall_id = p_mall_id
    and scope = 'payment:internal' and idempotency_key = p_idempotency_key and expires_at > now();
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_existing.response_json;
  end if;
  select * into v_order from public.orders where tenant_id = p_tenant_id and enterprise_id = p_enterprise_id
    and mall_id = p_mall_id and user_id = p_user_id and id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'pending_payment' or v_order.paid_cents <> 0 then raise exception 'ORDER_NOT_PAYABLE'; end if;
  if p_welfare_cents < 0 or p_meal_cents < 0 or p_welfare_cents + p_meal_cents <> v_order.payable_cents then
    raise exception 'PAYMENT_TOTAL_MISMATCH';
  end if;
  for v_channel, v_amount in select * from (values ('welfare', p_welfare_cents), ('meal', p_meal_cents)) x(channel, amount) where amount > 0 loop
    select * into v_account from public.welfare_accounts where tenant_id = p_tenant_id and enterprise_id = p_enterprise_id
      and mall_id = p_mall_id and user_id = p_user_id and account_type = v_channel for update;
    if not found or v_account.status <> 'active' then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
    update public.welfare_accounts set balance_cents = balance_cents - v_amount, version = version + 1, updated_at = v_now
      where id = v_account.id and balance_cents >= v_amount and status = 'active';
    get diagnostics v_changed = row_count;
    if v_changed <> 1 then raise exception 'INSUFFICIENT_ACCOUNT_BALANCE'; end if;
    v_payment_id := gen_random_uuid()::text;
    v_payment_no := 'PAY' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    insert into public.account_ledgers (id, tenant_id, mall_id, account_id, user_id, direction, amount_cents, balance_after_cents, business_type, business_id, idempotency_key, created_at)
      select gen_random_uuid()::text, p_tenant_id, p_mall_id, v_account.id, p_user_id, 'debit', v_amount, balance_cents, 'order_payment', p_order_id, p_idempotency_key || ':' || v_channel, v_now from public.welfare_accounts where id = v_account.id;
    insert into public.payments (id, payment_no, tenant_id, mall_id, user_id, order_id, channel, status, amount_cents, idempotency_key, created_at, completed_at)
      values (v_payment_id, v_payment_no, p_tenant_id, p_mall_id, p_user_id, p_order_id, v_channel, 'succeeded', v_amount, p_idempotency_key || ':' || v_channel, v_now, v_now);
    insert into public.payment_allocations (id, tenant_id, mall_id, payment_id, order_id, account_id, channel, amount_cents)
      values (gen_random_uuid()::text, p_tenant_id, p_mall_id, v_payment_id, p_order_id, v_account.id, v_channel, v_amount);
    v_payment_nos := v_payment_nos || jsonb_build_array(v_payment_no);
  end loop;
  update public.orders set paid_cents = payable_cents, status = 'paid', paid_at = v_now, updated_at = v_now where id = p_order_id;
  update public.sub_orders set status = 'paid', updated_at = v_now where tenant_id = p_tenant_id and mall_id = p_mall_id and parent_order_id = p_order_id;
  v_response := jsonb_build_object('payment', jsonb_build_object('orderId', p_order_id, 'orderNo', v_order.order_no, 'paymentNos', v_payment_nos, 'status', 'succeeded', 'amountCents', v_order.payable_cents, 'completedAt', v_now), 'requestId', p_request_id);
  insert into public.idempotency_keys values (p_tenant_id, p_mall_id, 'payment:internal', p_idempotency_key, p_request_hash, p_order_id, v_response, v_now, v_now + interval '24 hours');
  insert into public.audit_logs (id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action, resource_type, resource_id, request_id, user_agent, after_json, created_at)
    values (gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, 'user', 'payment.internal.succeeded', 'order', p_order_id, p_request_id, left(coalesce(p_user_agent, ''), 300), jsonb_build_object('amountCents', v_order.payable_cents, 'paymentNos', v_payment_nos), v_now);
  return v_response;
end;
$$;

create or replace function public.api_execute_internal_refund(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_operator_user_id text,
  p_after_sale_id text, p_refund_cents bigint, p_idempotency_key text,
  p_request_hash text, p_request_id text, p_user_agent text
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_existing public.idempotency_keys%rowtype; v_after_sale public.after_sales%rowtype;
  v_order public.orders%rowtype; v_payment record; v_account public.welfare_accounts%rowtype;
  v_remaining bigint := p_refund_cents; v_refund_amount bigint; v_now timestamptz := clock_timestamp();
  v_refund_nos jsonb := '[]'::jsonb; v_refund_no text; v_response jsonb; v_total_refunded bigint;
begin
  if p_refund_cents <= 0 or length(trim(coalesce(p_idempotency_key, ''))) = 0 or length(p_idempotency_key) > 120 then raise exception 'IDEMPOTENCY_KEY_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtext(p_mall_id || ':refund:' || p_idempotency_key));
  select * into v_existing from public.idempotency_keys where mall_id = p_mall_id and scope = 'refund:internal' and idempotency_key = p_idempotency_key and expires_at > now();
  if found then if v_existing.request_hash <> p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return v_existing.response_json; end if;
  select a.* into v_after_sale from public.after_sales a join public.orders o on o.id = a.order_id
    where a.id = p_after_sale_id and a.tenant_id = p_tenant_id and a.mall_id = p_mall_id and o.enterprise_id = p_enterprise_id for update of a;
  if not found or v_after_sale.status not in ('submitted', 'reviewing', 'approved') or v_after_sale.type = 'exchange' then raise exception 'AFTER_SALE_NOT_REFUNDABLE'; end if;
  select * into v_order from public.orders where id = v_after_sale.order_id and tenant_id = p_tenant_id and enterprise_id = p_enterprise_id and mall_id = p_mall_id for update;
  if p_refund_cents > v_after_sale.requested_amount_cents then raise exception 'REFUND_AMOUNT_EXCEEDED'; end if;
  select coalesce(sum(amount_cents), 0) into v_total_refunded from public.refunds where order_id = v_order.id and status = 'succeeded';
  if p_refund_cents > v_order.paid_cents - v_total_refunded then raise exception 'REFUND_AMOUNT_EXCEEDED'; end if;
  if exists (select 1 from public.payments where order_id = v_order.id and status = 'succeeded' and channel not in ('welfare', 'meal')) then raise exception 'REFUND_CHANNEL_UNSUPPORTED'; end if;
  for v_payment in
    select p.id, p.payment_no, p.channel, p.amount_cents, p.user_id, coalesce(sum(r.amount_cents) filter (where r.status = 'succeeded'), 0) as refunded_cents
    from public.payments p left join public.refunds r on r.payment_id = p.id
    where p.order_id = v_order.id and p.status = 'succeeded'
    group by p.id order by p.completed_at, p.id
  loop
    exit when v_remaining = 0;
    v_refund_amount := least(v_remaining, v_payment.amount_cents - v_payment.refunded_cents);
    if v_refund_amount <= 0 then continue; end if;
    select * into v_account from public.welfare_accounts where tenant_id = p_tenant_id and enterprise_id = p_enterprise_id and mall_id = p_mall_id and user_id = v_payment.user_id and account_type = v_payment.channel for update;
    if not found then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
    update public.welfare_accounts set balance_cents = balance_cents + v_refund_amount, version = version + 1, updated_at = v_now where id = v_account.id;
    insert into public.account_ledgers (id, tenant_id, mall_id, account_id, user_id, direction, amount_cents, balance_after_cents, business_type, business_id, idempotency_key, created_at)
      select gen_random_uuid()::text, p_tenant_id, p_mall_id, v_account.id, v_payment.user_id, 'credit', v_refund_amount, balance_cents, 'order_refund', v_order.id, p_idempotency_key || ':' || v_payment.id, v_now from public.welfare_accounts where id = v_account.id;
    insert into public.refunds (id, refund_no, tenant_id, mall_id, order_id, payment_id, amount_cents, status, reason, idempotency_key, created_at, completed_at)
      values (gen_random_uuid()::text, 'REF' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)), p_tenant_id, p_mall_id, v_order.id, v_payment.id, v_refund_amount, 'succeeded', v_after_sale.reason, p_idempotency_key || ':' || v_payment.id, v_now, v_now)
      returning refund_no into v_refund_no;
    v_refund_nos := v_refund_nos || jsonb_build_array(v_refund_no); v_remaining := v_remaining - v_refund_amount;
  end loop;
  if v_remaining <> 0 then raise exception 'REFUND_AMOUNT_EXCEEDED'; end if;
  select coalesce(sum(amount_cents), 0) into v_total_refunded from public.refunds where order_id = v_order.id and status = 'succeeded';
  update public.after_sales set status = 'completed', updated_at = v_now where id = v_after_sale.id;
  update public.orders set status = case when v_total_refunded = paid_cents then 'refunded' else 'paid' end, updated_at = v_now where id = v_order.id;
  v_response := jsonb_build_object('refund', jsonb_build_object('afterSaleId', v_after_sale.id, 'orderId', v_order.id, 'amountCents', p_refund_cents, 'refundNos', v_refund_nos, 'status', 'succeeded', 'completedAt', v_now), 'requestId', p_request_id);
  insert into public.idempotency_keys values (p_tenant_id, p_mall_id, 'refund:internal', p_idempotency_key, p_request_hash, v_after_sale.id, v_response, v_now, v_now + interval '24 hours');
  insert into public.audit_logs (id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action, resource_type, resource_id, request_id, user_agent, after_json, created_at)
    values (gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_operator_user_id, 'admin', 'refund.internal.succeeded', 'after_sale', v_after_sale.id, p_request_id, left(coalesce(p_user_agent, ''), 300), jsonb_build_object('orderId', v_order.id, 'amountCents', p_refund_cents, 'refundNos', v_refund_nos), v_now);
  return v_response;
end;
$$;

create or replace function public.api_finance_reconciliation(p_tenant_id text, p_enterprise_id text, p_mall_id text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with checks as (
    select o.id, o.order_no, o.status, o.payable_cents, o.paid_cents,
      coalesce((select sum(p.amount_cents) from public.payments p where p.order_id = o.id and p.status = 'succeeded'), 0) as payment_cents,
      coalesce((select sum(a.amount_cents) from public.payment_allocations a join public.payments p on p.id = a.payment_id where a.order_id = o.id and p.status = 'succeeded'), 0) as allocation_cents,
      coalesce((select sum(l.amount_cents) from public.account_ledgers l where l.business_type = 'order_payment' and l.business_id = o.id and l.direction = 'debit'), 0) as debit_cents,
      coalesce((select sum(r.amount_cents) from public.refunds r where r.order_id = o.id and r.status = 'succeeded'), 0) as refund_cents,
      coalesce((select sum(l.amount_cents) from public.account_ledgers l where l.business_type = 'order_refund' and l.business_id = o.id and l.direction = 'credit'), 0) as credit_cents
    from public.orders o where o.tenant_id = p_tenant_id and o.enterprise_id = p_enterprise_id and o.mall_id = p_mall_id
  ), violations as (
    select *, array_remove(array[
      case when paid_cents <> payment_cents then 'PAID_PAYMENT_MISMATCH' end,
      case when allocation_cents <> payment_cents then 'PAYMENT_ALLOCATION_MISMATCH' end,
      case when debit_cents <> payment_cents then 'PAYMENT_LEDGER_MISMATCH' end,
      case when credit_cents <> refund_cents then 'REFUND_LEDGER_MISMATCH' end,
      case when refund_cents > payment_cents then 'OVER_REFUND' end,
      case when status = 'refunded' and refund_cents <> paid_cents then 'REFUNDED_STATUS_MISMATCH' end
    ], null) as issues from checks
  )
  select jsonb_build_object('checkedAt', clock_timestamp(), 'ordersChecked', (select count(*) from checks), 'violationCount', (select count(*) from violations where cardinality(issues) > 0), 'violations', coalesce((select jsonb_agg(jsonb_build_object('orderId', id, 'orderNo', order_no, 'issues', issues, 'payableCents', payable_cents, 'paidCents', paid_cents, 'paymentCents', payment_cents, 'refundCents', refund_cents)) from violations where cardinality(issues) > 0), '[]'::jsonb));
$$;

revoke all on function public.api_execute_internal_refund(text,text,text,text,text,bigint,text,text,text,text) from public, anon, authenticated;
revoke all on function public.api_finance_reconciliation(text,text,text) from public, anon, authenticated;
grant execute on function public.api_execute_internal_refund(text,text,text,text,text,bigint,text,text,text,text) to service_role;
grant execute on function public.api_finance_reconciliation(text,text,text) to service_role;
