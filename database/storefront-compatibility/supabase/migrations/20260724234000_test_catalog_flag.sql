alter table public.products
  add column if not exists is_test boolean not null default false;

comment on column public.products.is_test is
  'True only for non-production catalog records used for development and load testing.';

create index if not exists idx_products_test_catalog
  on public.products (mall_id, is_test, status, category_code);

drop function if exists public.api_catalog(text, text, integer, integer);

create or replace function public.api_catalog(
  p_mall_slug text,
  p_category text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id text,
  sku_id text,
  name text,
  subtitle text,
  category_code text,
  cover_url text,
  price_cents bigint,
  market_price_cents bigint,
  available_stock integer,
  supplier_name text,
  is_test boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    s.id,
    p.name,
    p.subtitle,
    p.category_code,
    p.cover_url,
    s.price_cents,
    s.market_price_cents,
    i.available_qty - i.reserved_qty,
    supplier.name,
    p.is_test
  from public.products p
  join public.malls m on m.id = p.mall_id
  join public.skus s on s.product_id = p.id and s.mall_id = p.mall_id
  join public.inventory i on i.sku_id = s.id and i.mall_id = p.mall_id
  join public.suppliers supplier on supplier.id = p.supplier_id
  where m.public_slug = p_mall_slug
    and (p_category is null or p.category_code = p_category)
    and p.status = 'active'
    and s.status = 'active'
    and m.status = 'active'
  order by p.created_at desc, s.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.api_catalog(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.api_catalog(text, text, integer, integer)
  to service_role;

create or replace function public.reject_test_product_order_item()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.products p
    where p.id = new.product_id and p.is_test
  ) then
    raise exception 'TEST_PRODUCT_NOT_ORDERABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reject_test_product_order_item
  on public.order_items;
create trigger trg_reject_test_product_order_item
before insert or update of product_id on public.order_items
for each row execute function public.reject_test_product_order_item();

create or replace function public.purge_test_catalog(p_mall_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_products integer;
  v_skus integer;
begin
  delete from public.cart_items ci
  using public.skus s, public.products p
  where ci.sku_id = s.id
    and s.product_id = p.id
    and p.mall_id = p_mall_id
    and p.is_test;

  delete from public.inventory i
  using public.skus s, public.products p
  where i.sku_id = s.id
    and s.product_id = p.id
    and p.mall_id = p_mall_id
    and p.is_test;

  delete from public.skus s
  using public.products p
  where s.product_id = p.id
    and p.mall_id = p_mall_id
    and p.is_test;
  get diagnostics v_skus = row_count;

  delete from public.products p
  where p.mall_id = p_mall_id and p.is_test;
  get diagnostics v_products = row_count;

  return jsonb_build_object(
    'mallId', p_mall_id,
    'deletedProducts', v_products,
    'deletedSkus', v_skus
  );
end;
$$;

revoke all on function public.purge_test_catalog(text)
  from public, anon, authenticated;
grant execute on function public.purge_test_catalog(text)
  to service_role;
