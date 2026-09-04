-- Exports use a separate capped reader so normal page queries can stay bounded at 100 rows.

create or replace function public.api_admin_order_export(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text default null,
  p_keyword text default null, p_status text default null, p_created_from timestamptz default null,
  p_created_to timestamptz default null, p_sort text default 'created_at_desc'
)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  with ranked as (
    select o.*, row_number() over (
      order by case when p_sort = 'created_at_asc' then o.created_at end asc,
        case when p_sort = 'payable_asc' then o.payable_cents end asc,
        case when p_sort = 'payable_desc' then o.payable_cents end desc, o.created_at desc, o.id desc
    ) as position
    from public.orders o
    where o.tenant_id = p_tenant_id and o.enterprise_id = p_enterprise_id and o.mall_id = p_mall_id and (p_user_id is null or o.user_id = p_user_id)
      and (nullif(trim(p_keyword), '') is null or o.order_no ilike '%' || trim(p_keyword) || '%' or exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.product_name_snapshot ilike '%' || trim(p_keyword) || '%'))
      and (p_status is null or o.status = p_status) and (p_created_from is null or o.created_at >= p_created_from) and (p_created_to is null or o.created_at < p_created_to)
  ), scoped as (
    select * from ranked order by position limit 5001
  ) select coalesce(jsonb_agg(jsonb_build_object(
    'orderNo', o.order_no, 'firstProductName', coalesce((select oi.product_name_snapshot from public.order_items oi where oi.order_id = o.id order by oi.id limit 1), '订单商品'),
    'itemCount', coalesce((select sum(oi.quantity) from public.order_items oi where oi.order_id = o.id), 0), 'payableCents', o.payable_cents, 'paidCents', o.paid_cents,
    'welfarePaidCents', coalesce((select sum(pa.amount_cents) from public.payment_allocations pa where pa.order_id = o.id and pa.channel = 'welfare'), 0),
    'mealPaidCents', coalesce((select sum(pa.amount_cents) from public.payment_allocations pa where pa.order_id = o.id and pa.channel = 'meal'), 0),
    'supplierNames', coalesce((select string_agg(x.name, '、' order by x.name) from (select distinct s.name from public.order_items oi join public.sub_orders so on so.id = oi.sub_order_id join public.suppliers s on s.id = so.supplier_id where oi.order_id = o.id) x), ''),
    'status', o.status, 'createdAt', o.created_at
  ) order by o.position), '[]'::jsonb) from scoped o;
$$;

create or replace function public.api_admin_after_sale_export(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_user_id text default null,
  p_keyword text default null, p_status text default null, p_created_from timestamptz default null,
  p_created_to timestamptz default null, p_sort text default 'created_at_desc'
)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  with ranked as (
    select a.*, o.order_no, row_number() over (
      order by case when p_sort = 'created_at_asc' then a.created_at end asc,
        case when p_sort = 'payable_asc' then a.requested_amount_cents end asc,
        case when p_sort = 'payable_desc' then a.requested_amount_cents end desc, a.created_at desc, a.id desc
    ) as position
    from public.after_sales a join public.orders o on o.id = a.order_id
    where o.tenant_id = p_tenant_id and o.enterprise_id = p_enterprise_id and o.mall_id = p_mall_id and (p_user_id is null or o.user_id = p_user_id)
      and (nullif(trim(p_keyword), '') is null or a.after_sale_no ilike '%' || trim(p_keyword) || '%' or o.order_no ilike '%' || trim(p_keyword) || '%')
      and (p_status is null or a.status = p_status) and (p_created_from is null or a.created_at >= p_created_from) and (p_created_to is null or a.created_at < p_created_to)
  ), scoped as (
    select * from ranked order by position limit 5001
  ) select coalesce(jsonb_agg(jsonb_build_object(
    'afterSaleNo', a.after_sale_no, 'orderNo', a.order_no, 'type', a.type, 'status', a.status, 'reason', a.reason,
    'requestedAmountCents', a.requested_amount_cents, 'createdAt', a.created_at
  ) order by a.position), '[]'::jsonb) from scoped a;
$$;

create or replace function public.api_record_order_export_audit(
  p_tenant_id text, p_enterprise_id text, p_mall_id text, p_operator_user_id text, p_export_type text,
  p_filters jsonb, p_row_count integer, p_request_id text, p_membership_id text, p_granted_via jsonb
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_export_type not in ('orders', 'after_sales') or p_row_count < 0 then raise exception 'INVALID_ORDER_EXPORT_INPUT'; end if;
  insert into public.audit_logs (id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type, action, resource_type, request_id, after_json, membership_id, granted_via, created_at)
  values (gen_random_uuid()::text, p_tenant_id, p_enterprise_id, p_mall_id, p_operator_user_id, 'admin', 'order.export',
    p_export_type, p_request_id, jsonb_build_object('filters', coalesce(p_filters, '{}'::jsonb), 'rowCount', p_row_count), p_membership_id, p_granted_via, now());
end;
$$;

revoke all on function public.api_admin_order_export(text,text,text,text,text,text,timestamptz,timestamptz,text) from public, anon, authenticated;
revoke all on function public.api_admin_after_sale_export(text,text,text,text,text,text,timestamptz,timestamptz,text) from public, anon, authenticated;
revoke all on function public.api_record_order_export_audit(text,text,text,text,text,jsonb,integer,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.api_admin_order_export(text,text,text,text,text,text,timestamptz,timestamptz,text) to service_role;
grant execute on function public.api_admin_after_sale_export(text,text,text,text,text,text,timestamptz,timestamptz,text) to service_role;
grant execute on function public.api_record_order_export_audit(text,text,text,text,text,jsonb,integer,text,text,jsonb) to service_role;
