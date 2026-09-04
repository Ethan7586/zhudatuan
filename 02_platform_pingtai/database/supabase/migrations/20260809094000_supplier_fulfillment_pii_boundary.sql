-- Supplier fulfillment must never expose a parent order that contains
-- other suppliers' line items. Each sub-order owns an encrypted recipient copy.

alter table public.sub_orders
  add column if not exists recipient_snapshot_json jsonb;

create or replace function public.copy_recipient_snapshot_to_sub_order()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  select o.recipient_snapshot_json
  into new.recipient_snapshot_json
  from public.orders o
  where o.id = new.parent_order_id
    and o.tenant_id = new.tenant_id
    and o.mall_id = new.mall_id;

  if new.recipient_snapshot_json is null then
    raise exception 'PARENT_ORDER_RECIPIENT_NOT_FOUND';
  end if;
  return new;
end;
$$;

drop trigger if exists sub_orders_copy_recipient_snapshot on public.sub_orders;
create trigger sub_orders_copy_recipient_snapshot
before insert or update of parent_order_id, tenant_id, mall_id on public.sub_orders
for each row execute function public.copy_recipient_snapshot_to_sub_order();

update public.sub_orders sub_order
set recipient_snapshot_json = parent_order.recipient_snapshot_json
from public.orders parent_order
where sub_order.parent_order_id = parent_order.id
  and sub_order.recipient_snapshot_json is null;

alter table public.sub_orders
  alter column recipient_snapshot_json set not null;

-- Future supplier endpoints must query this view/RPC shape, not public.orders.
create or replace function public.api_supplier_fulfillment(
  p_tenant_id text,
  p_supplier_id text,
  p_sub_order_id text
)
returns table (
  sub_order_id text,
  sub_order_no text,
  status text,
  recipient_snapshot_json jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select sub_order.id, sub_order.sub_order_no, sub_order.status, sub_order.recipient_snapshot_json
  from public.sub_orders sub_order
  where sub_order.id = p_sub_order_id
    and sub_order.tenant_id = p_tenant_id
    and sub_order.supplier_id = p_supplier_id;
$$;

revoke all on function public.api_supplier_fulfillment(text, text, text) from public, anon, authenticated;
grant execute on function public.api_supplier_fulfillment(text, text, text) to service_role;

