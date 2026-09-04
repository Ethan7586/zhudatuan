-- Keep immutable order/payment facts intact while adding an adjacent,
-- membership-bound authorization record in the same transaction.
-- This closes the audit gap for employee-originated checkout operations.

create or replace function public.api_create_order_authorized(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_items jsonb, p_recipient_cipher jsonb, p_idempotency_key text,
  p_request_hash text, p_request_id text, p_user_agent text,
  p_membership_id text, p_granted_via jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_result jsonb; v_order_id text;
begin
  v_result := public.api_create_order(
    p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_items, p_recipient_cipher,
    p_idempotency_key, p_request_hash, p_request_id, p_user_agent
  );
  v_order_id := v_result #>> '{order,id}';
  if v_order_id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json, membership_id, granted_via, created_at
  )
  select gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, 'user',
    'order.create.authorized', 'order', v_order_id, p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('idempotencyKey', p_idempotency_key), p_membership_id, p_granted_via, now()
  where not exists (
    select 1 from public.audit_logs
    where resource_id = v_order_id and action = 'order.create.authorized'
      and after_json ->> 'idempotencyKey' = p_idempotency_key
  );
  return v_result;
end;
$$;

create or replace function public.api_pay_internal_authorized(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text,
  p_order_id text, p_welfare_cents bigint, p_meal_cents bigint,
  p_idempotency_key text, p_request_hash text, p_request_id text, p_user_agent text,
  p_membership_id text, p_granted_via jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  v_result := public.api_pay_internal(
    p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, p_order_id,
    p_welfare_cents, p_meal_cents, p_idempotency_key, p_request_hash, p_request_id, p_user_agent
  );
  insert into public.audit_logs (
    id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action,
    resource_type, resource_id, request_id, user_agent, after_json, membership_id, granted_via, created_at
  )
  select gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_user_id, 'user',
    'payment.internal.authorized', 'order', p_order_id, p_request_id, left(coalesce(p_user_agent, ''), 300),
    jsonb_build_object('idempotencyKey', p_idempotency_key), p_membership_id, p_granted_via, now()
  where not exists (
    select 1 from public.audit_logs
    where resource_id = p_order_id and action = 'payment.internal.authorized'
      and after_json ->> 'idempotencyKey' = p_idempotency_key
  );
  return v_result;
end;
$$;

revoke all on function public.api_create_order_authorized(text,text,text,text,jsonb,jsonb,text,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.api_pay_internal_authorized(text,text,text,text,text,bigint,bigint,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.api_create_order_authorized(text,text,text,text,jsonb,jsonb,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.api_pay_internal_authorized(text,text,text,text,text,bigint,bigint,text,text,text,text,text,jsonb) to service_role;
