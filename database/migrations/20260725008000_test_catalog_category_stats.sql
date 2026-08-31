create or replace function public.api_test_catalog_stats()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'allProducts', (select count(*) from public.products),
    'testProducts', (select count(*) from public.products where is_test = true),
    'allSkus', (select count(*) from public.skus),
    'testSkus', (
      select count(*) from public.skus s
      join public.products p on p.id = s.product_id
      where p.is_test = true
    ),
    'allInventory', (select count(*) from public.inventory),
    'testInventory', (
      select count(*) from public.inventory i
      join public.skus s on s.id = i.sku_id
      join public.products p on p.id = s.product_id
      where p.is_test = true
    ),
    'testCategoryBreakdown', (
      select coalesce(jsonb_object_agg(category_code, product_count), '{}'::jsonb)
      from (
        select category_code, count(*) as product_count
        from public.products
        where is_test = true
        group by category_code
      ) category_counts
    ),
    'databaseSizeBytes', pg_database_size(current_database())
  );
$$;
