drop function if exists public.api_catalog(text, text, integer, integer);

create function public.api_catalog(
  p_mall_slug text,
  p_category text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id text, sku_id text, name text, name_en text, name_zh text,
  subtitle text, subtitle_en text, subtitle_zh text, category_code text,
  taxonomy_l1 text, taxonomy_l2 text, taxonomy_l3 text,
  classification_status text, cover_url text, price_cents bigint,
  market_price_cents bigint, available_stock integer, supplier_name text, is_test boolean
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id, s.id, coalesce(p.name_zh, p.name), p.name_en, p.name_zh,
    coalesce(p.subtitle_zh, p.subtitle), p.subtitle_en, p.subtitle_zh,
    p.category_code, p.taxonomy_l1, p.taxonomy_l2, p.taxonomy_l3,
    p.classification_status, p.cover_url, s.price_cents, s.market_price_cents,
    i.available_qty - i.reserved_qty, supplier.name, p.is_test
  from public.products p
  join public.malls m on m.id = p.mall_id
  join public.skus s on s.product_id = p.id and s.mall_id = p.mall_id
  join public.inventory i on i.sku_id = s.id and i.mall_id = p.mall_id
  join public.suppliers supplier on supplier.id = p.supplier_id
  where m.public_slug = p_mall_slug
    and (p_category is null or p.category_code = p_category)
    and p.status = 'active' and s.status = 'active' and m.status = 'active'
  order by p.created_at desc, s.id
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

revoke all on function public.api_catalog(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.api_catalog(text, text, integer, integer)
  to service_role;
