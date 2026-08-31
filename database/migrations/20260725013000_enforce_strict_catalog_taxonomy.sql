create or replace function public.is_valid_catalog_taxonomy_path(
  p_l1 text, p_l2 text, p_l3 text
) returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.catalog_taxonomy_nodes l1
    join public.catalog_taxonomy_nodes l2 on l2.parent_code = l1.code and l2.level = 2
    join public.catalog_taxonomy_nodes l3 on l3.parent_code = l2.code and l3.level = 3
    where l1.level = 1 and l1.status = 'active' and l2.status = 'active' and l3.status = 'active'
      and l1.code = p_l1 and l2.code = p_l2 and l3.code = p_l3
  );
$$;

create or replace function public.enforce_product_taxonomy_path()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.status = 'active' and new.classification_status <> 'pending'
    and not public.is_valid_catalog_taxonomy_path(new.taxonomy_l1, new.taxonomy_l2, new.taxonomy_l3) then
    raise exception 'Invalid taxonomy path for product %', new.id using errcode = '23514';
  end if;
  if new.taxonomy_l1 is not null then
    new.category_code := new.taxonomy_l1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_strict_taxonomy_path on public.products;
create trigger trg_products_strict_taxonomy_path
before insert or update of taxonomy_l1, taxonomy_l2, taxonomy_l3, category_code, classification_status, status
on public.products for each row execute function public.enforce_product_taxonomy_path();

create or replace function public.api_catalog(
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
    p.taxonomy_l1, p.taxonomy_l1, p.taxonomy_l2, p.taxonomy_l3,
    p.classification_status, p.cover_url, s.price_cents, s.market_price_cents,
    i.available_qty - i.reserved_qty, supplier.name, p.is_test
  from public.products p
  join public.malls m on m.id = p.mall_id
  join public.skus s on s.product_id = p.id and s.mall_id = p.mall_id
  join public.inventory i on i.sku_id = s.id and i.mall_id = p.mall_id
  join public.suppliers supplier on supplier.id = p.supplier_id
  where m.public_slug = p_mall_slug
    and (p_category is null or p.taxonomy_l1 = p_category)
    and public.is_valid_catalog_taxonomy_path(p.taxonomy_l1, p.taxonomy_l2, p.taxonomy_l3)
    and p.classification_confidence >= 0.8
    and p.status = 'active' and s.status = 'active' and m.status = 'active'
  order by p.created_at desc, s.id
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

create or replace function public.api_catalog_taxonomy_audit()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'validPaths', count(*) filter (where public.is_valid_catalog_taxonomy_path(taxonomy_l1, taxonomy_l2, taxonomy_l3)),
    'invalidPaths', count(*) filter (where not public.is_valid_catalog_taxonomy_path(taxonomy_l1, taxonomy_l2, taxonomy_l3)),
    'publicEligible', count(*) filter (where public.is_valid_catalog_taxonomy_path(taxonomy_l1, taxonomy_l2, taxonomy_l3) and classification_confidence >= 0.8),
    'reviewRequired', count(*) filter (where classification_confidence < 0.8 or taxonomy_l3 = 'welfare_review_unclassified')
  ) from public.products where is_test = true;
$$;

revoke all on function public.api_catalog_taxonomy_audit() from public, anon, authenticated;
grant execute on function public.api_catalog_taxonomy_audit() to service_role;
