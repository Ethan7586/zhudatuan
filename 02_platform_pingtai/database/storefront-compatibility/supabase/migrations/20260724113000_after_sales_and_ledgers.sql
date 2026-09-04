create or replace function public.api_account_ledgers(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text
)
returns table (
  id text,
  "accountType" text,
  direction text,
  "amountCents" bigint,
  "balanceAfterCents" bigint,
  "businessType" text,
  "businessId" text,
  "orderNo" text,
  "createdAt" timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    l.id,
    a.account_type,
    l.direction,
    l.amount_cents,
    l.balance_after_cents,
    l.business_type,
    l.business_id,
    o.order_no,
    l.created_at
  from public.account_ledgers l
  join public.welfare_accounts a
    on a.id = l.account_id
   and a.tenant_id = p_tenant_id
   and a.enterprise_id = p_enterprise_id
   and a.mall_id = p_mall_id
   and a.user_id = p_user_id
  left join public.orders o
    on l.business_type = 'order_payment'
   and o.id = l.business_id
   and o.tenant_id = p_tenant_id
   and o.mall_id = p_mall_id
   and o.user_id = p_user_id
  where l.tenant_id = p_tenant_id
    and l.mall_id = p_mall_id
    and l.user_id = p_user_id
  order by l.created_at desc
  limit 200;
$$;

create or replace function public.api_after_sales(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text
)
returns table (
  id text,
  "afterSaleNo" text,
  "orderId" text,
  "orderNo" text,
  type text,
  status text,
  reason text,
  "requestedAmountCents" bigint,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    a.id,
    a.after_sale_no,
    a.order_id,
    o.order_no,
    a.type,
    a.status,
    a.reason,
    a.requested_amount_cents,
    a.created_at,
    a.updated_at
  from public.after_sales a
  join public.orders o
    on o.id = a.order_id
   and o.tenant_id = p_tenant_id
   and o.enterprise_id = p_enterprise_id
   and o.mall_id = p_mall_id
   and o.user_id = p_user_id
  where a.tenant_id = p_tenant_id
    and a.mall_id = p_mall_id
    and a.user_id = p_user_id
  order by a.created_at desc
  limit 100;
$$;

create or replace function public.api_create_after_sale(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_order_id text, p_type text, p_reason text, p_requested_amount_cents bigint,
  p_request_id text, p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_after_sale_id text := gen_random_uuid()::text;
  v_after_sale_no text := 'AS' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') ||
                          upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_now timestamptz := clock_timestamp();
begin
  if p_type not in ('refund_only', 'return_refund', 'exchange')
     or length(trim(coalesce(p_reason, ''))) < 2
     or length(p_reason) > 500
     or p_requested_amount_cents <= 0 then
    raise exception 'INVALID_AFTER_SALE_INPUT';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and tenant_id = p_tenant_id
    and enterprise_id = p_enterprise_id
    and mall_id = p_mall_id
    and user_id = p_user_id
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status not in ('paid', 'processing', 'shipped', 'completed') then
    raise exception 'ORDER_NOT_AFTER_SALE_ELIGIBLE';
  end if;
  if p_requested_amount_cents > v_order.paid_cents then
    raise exception 'AFTER_SALE_AMOUNT_EXCEEDED';
  end if;
  if exists (
    select 1 from public.after_sales
    where tenant_id = p_tenant_id and mall_id = p_mall_id
      and user_id = p_user_id and order_id = p_order_id
      and status not in ('rejected', 'completed', 'closed')
  ) then
    raise exception 'AFTER_SALE_ALREADY_EXISTS';
  end if;

  insert into public.after_sales (
    id, after_sale_no, tenant_id, mall_id, user_id, order_id, type, status,
    reason, requested_amount_cents, created_at, updated_at
  ) values (
    v_after_sale_id, v_after_sale_no, p_tenant_id, p_mall_id, p_user_id,
    p_order_id, p_type, 'submitted', trim(p_reason),
    p_requested_amount_cents, v_now, v_now
  );

  update public.orders
  set status = 'refund_pending', updated_at = v_now
  where id = p_order_id;

  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type,
    action, resource_type, resource_id, request_id, user_agent, after_json, created_at
  ) values (
    gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id,
    'user', 'after_sale.submit', 'after_sale', v_after_sale_id, p_request_id,
    left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object(
      'afterSaleNo', v_after_sale_no,
      'orderId', p_order_id,
      'type', p_type,
      'requestedAmountCents', p_requested_amount_cents
    ),
    v_now
  );

  return jsonb_build_object(
    'afterSale', jsonb_build_object(
      'id', v_after_sale_id,
      'afterSaleNo', v_after_sale_no,
      'orderId', p_order_id,
      'orderNo', v_order.order_no,
      'type', p_type,
      'status', 'submitted',
      'reason', trim(p_reason),
      'requestedAmountCents', p_requested_amount_cents,
      'createdAt', v_now,
      'updatedAt', v_now
    ),
    'requestId', p_request_id
  );
end;
$$;

create table if not exists public.login_attempts (
  ip_hash text primary key,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.login_attempts enable row level security;

create or replace function public.api_login_allowed(p_ip_hash text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
    from public.login_attempts
    where ip_hash = p_ip_hash
      and blocked_until is not null
      and blocked_until > now()
  );
$$;

create or replace function public.api_record_login_failure(p_ip_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_blocked_until timestamptz;
begin
  insert into public.login_attempts (
    ip_hash, failed_attempts, window_started_at, blocked_until, updated_at
  ) values (
    p_ip_hash, 1, v_now, null, v_now
  )
  on conflict (ip_hash) do update
  set
    failed_attempts = case
      when public.login_attempts.window_started_at < v_now - interval '15 minutes'
        then 1
      else public.login_attempts.failed_attempts + 1
    end,
    window_started_at = case
      when public.login_attempts.window_started_at < v_now - interval '15 minutes'
        then v_now
      else public.login_attempts.window_started_at
    end,
    blocked_until = case
      when (
        case
          when public.login_attempts.window_started_at < v_now - interval '15 minutes'
            then 1
          else public.login_attempts.failed_attempts + 1
        end
      ) >= 5 then v_now + interval '15 minutes'
      else public.login_attempts.blocked_until
    end,
    updated_at = v_now
  returning blocked_until into v_blocked_until;
  return v_blocked_until;
end;
$$;

create or replace function public.api_clear_login_failures(p_ip_hash text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.login_attempts where ip_hash = p_ip_hash;
$$;

revoke all on function public.api_account_ledgers(text,text,text,text) from public, anon, authenticated;
revoke all on function public.api_after_sales(text,text,text,text) from public, anon, authenticated;
revoke all on function public.api_create_after_sale(text,text,text,text,text,text,text,bigint,text,text) from public, anon, authenticated;
revoke all on function public.api_login_allowed(text) from public, anon, authenticated;
revoke all on function public.api_record_login_failure(text) from public, anon, authenticated;
revoke all on function public.api_clear_login_failures(text) from public, anon, authenticated;

grant execute on function public.api_account_ledgers(text,text,text,text) to service_role;
grant execute on function public.api_after_sales(text,text,text,text) to service_role;
grant execute on function public.api_create_after_sale(text,text,text,text,text,text,text,bigint,text,text) to service_role;
grant execute on function public.api_login_allowed(text) to service_role;
grant execute on function public.api_record_login_failure(text) to service_role;
grant execute on function public.api_clear_login_failures(text) to service_role;
