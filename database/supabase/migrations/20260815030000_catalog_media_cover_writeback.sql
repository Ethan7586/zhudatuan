create or replace function public.api_sync_catalog_media_covers(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item_count integer;
  distinct_count integer;
  matched_count integer;
  updated_count integer;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = '22023', message = 'catalog media payload must be an array';
  end if;

  select count(*), count(distinct item ->> 'id')
  into item_count, distinct_count
  from jsonb_array_elements(p_items) as item;

  if item_count < 1 or item_count > 200 then
    raise exception using errcode = '22023', message = 'catalog media payload must contain 1 to 200 products';
  end if;

  if distinct_count <> item_count then
    raise exception using errcode = '22023', message = 'catalog media payload contains duplicate product ids';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item
    where jsonb_typeof(item) <> 'object'
       or coalesce(item ->> 'id', '') = ''
       or length(item ->> 'id') > 160
       or coalesce(item ->> 'coverUrl', '') !~ '^https://img\.hbbtzn\.com/catalog/products/[A-Za-z0-9_-]+/[a-f0-9]{16}/cover-[0-9]{3,4}\.webp$'
  ) then
    raise exception using errcode = '22023', message = 'catalog media payload contains an invalid product id or CDN cover URL';
  end if;

  select count(*)
  into matched_count
  from public.products as product
  join jsonb_array_elements(p_items) as item
    on product.id = item ->> 'id';

  if matched_count <> item_count then
    raise exception using errcode = 'P0002', message = 'catalog media payload references an unknown product';
  end if;

  update public.products as product
  set cover_url = item ->> 'coverUrl',
      updated_at = now()
  from jsonb_array_elements(p_items) as item
  where product.id = item ->> 'id'
    and product.cover_url is distinct from item ->> 'coverUrl';

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.api_sync_catalog_media_covers(jsonb) from public, anon, authenticated;
grant execute on function public.api_sync_catalog_media_covers(jsonb) to service_role;
