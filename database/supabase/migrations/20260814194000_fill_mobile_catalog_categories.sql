create or replace function public.classify_abo_product_taxonomy(
  p_name text,
  p_subtitle text,
  p_detail_json jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_type text := upper(coalesce(p_detail_json->>'productType', ''));
  v_text text := lower(concat_ws(' ', p_name, p_subtitle, p_detail_json->>'brand',
    p_detail_json->>'model', p_detail_json->>'productType', p_detail_json->>'description'));
begin
  if v_type ~ '(GROCERY|FOOD|SNACK|COFFEE|TEA|BEVERAGE|DAIRY|HERB|CEREAL)'
    or v_text ~ '(food|grocery|snack|coffee|tea|beverage|cereal|pasta|sauce|chocolate|cookie|candy|rice|flour|spice|organic|milk|juice|wine|beer|sugar|cream cheese|fruit spread|ice cream|soup|ground beef|食品|零食|咖啡|茶饮|牛奶|饮料|大米|杂粮|食用油|调味)' then
    if v_text ~ '(rice|grain|cereal|flour|pasta|大米|杂粮)' then
      return jsonb_build_object('l1', 'food', 'l2', 'food_grain', 'l3', 'food_grain_rice', 'confidence', 0.9);
    elsif v_text ~ '(oil|sauce|spice|seasoning|食用油|调味)' then
      return jsonb_build_object('l1', 'food', 'l2', 'food_grain', 'l3', 'food_grain_oil', 'confidence', 0.9);
    elsif v_text ~ '(coffee|tea|咖啡|茶饮)' then
      return jsonb_build_object('l1', 'food', 'l2', 'food_drink', 'l3', 'food_drink_coffee_tea', 'confidence', 0.9);
    elsif v_text ~ '(milk|dairy|beverage|juice|wine|beer|牛奶|乳品|饮料)' then
      return jsonb_build_object('l1', 'food', 'l2', 'food_drink', 'l3', 'food_drink_dairy', 'confidence', 0.88);
    end if;
    return jsonb_build_object('l1', 'food', 'l2', 'food_snack', 'l3', 'food_snack_nuts', 'confidence', 0.86);
  end if;

  if v_type ~ '(KITCHEN_APPLIANCE|VACUUM|REFRIGERATOR|AIR_CONDITIONER|HOME_APPLIANCE)'
    or v_text ~ '(vacuum|air purifier|purifier|refrigerator|microwave|oven|blender|mixer|food processor|coffee maker|kettle|toaster|washer|dryer|air conditioner|ceiling fan|heater|appliance|吸尘器|净化器|冰箱|微波炉|烤箱|料理机|搅拌机|电水壶|烤面包机|洗衣机|烘干机|空调)' then
    if v_text ~ '(air purifier|purifier|air conditioner|ceiling fan|heater|净化器|空调)' then
      return jsonb_build_object('l1', 'appliance', 'l2', 'appliance_living', 'l3', 'appliance_living_air', 'confidence', 0.9);
    elsif v_text ~ '(vacuum|washer|dryer|refrigerator|filter cartridge|吸尘器|洗衣机|烘干机|冰箱)' then
      return jsonb_build_object('l1', 'appliance', 'l2', 'appliance_living', 'l3', 'appliance_living_clean', 'confidence', 0.88);
    end if;
    return jsonb_build_object('l1', 'appliance', 'l2', 'appliance_kitchen', 'l3', 'appliance_kitchen_cook', 'confidence', 0.88);
  end if;

  if v_type ~ '(CELLULAR_PHONE|PORTABLE_ELECTRONIC|WIRELESS_ACCESSORY|CHARGING_ADAPTER|HEADPHONES|SPEAKERS|MICROPHONE|CAMERA|COMPUTER|OFFICE_ELECTRONICS|OFFICE_PRODUCTS|WRITING_INSTRUMENT|3D_PRINTER)'
    or v_text ~ '(computer|laptop|notebook|monitor|keyboard|mouse|printer|camera|phone|tablet|headphone|headset|speaker|router|electronic|digital|usb|battery|charger|cable|playstation|ethernet|displayport|mobile cover|phone case|手机壳|手机套|耳机|音箱|电脑|笔记本|显示器|键盘|鼠标|打印机|相机|数据线|充电)' then
    if v_text ~ '(headphone|headset|speaker|microphone|耳机|音箱|麦克风)' then
      return jsonb_build_object('l1', 'digital', 'l2', 'digital_audio', 'l3', 'digital_audio_audio', 'confidence', 0.92);
    elsif v_text ~ '(phone case|mobile cover|electronic device cover|手机壳|手机套)' or v_type ~ '(CELLULAR_PHONE_CASE|PORTABLE_ELECTRONIC_DEVICE_COVER)' then
      return jsonb_build_object('l1', 'digital', 'l2', 'digital_mobile', 'l3', 'digital_mobile_accessory', 'confidence', 0.94);
    elsif v_text ~ '(phone|tablet|camera|手机|平板|相机)' then
      return jsonb_build_object('l1', 'digital', 'l2', 'digital_audio', 'l3', 'digital_audio_mobile', 'confidence', 0.88);
    elsif v_text ~ '(laptop|notebook|computer|monitor|笔记本|电脑整机|显示器)' then
      return jsonb_build_object('l1', 'digital', 'l2', 'digital_computer', 'l3', 'digital_computer_pc', 'confidence', 0.9);
    elsif v_text ~ '(office|paper|pen|stationery|crayon|办公|文具|纸品)' then
      return jsonb_build_object('l1', 'digital', 'l2', 'digital_office', 'l3', 'digital_office_stationery', 'confidence', 0.86);
    end if;
    return jsonb_build_object('l1', 'digital', 'l2', 'digital_computer', 'l3', 'digital_computer_peripheral', 'confidence', 0.88);
  end if;

  if v_type ~ '(BEAUTY|SKIN|HEALTH_PERSONAL_CARE|JANITORIAL|CLEANING|DRUGSTORE)'
    or v_text ~ '(shampoo|hair conditioner|soap|tooth|dental|skin|beauty|cosmetic|makeup|razor|shave|deodorant|lotion|towel|tissue|cleaning|detergent|body wash|washmittel|toilet roll|洗发|护发|香皂|沐浴露|牙膏|护肤|美妆|剃须|洗衣液|清洁剂|纸巾)' then
    if v_text ~ '(skin|beauty|cosmetic|makeup|lotion|razor|shave|护肤|美妆|剃须)' then
      return jsonb_build_object('l1', 'personal', 'l2', 'personal_beauty', 'l3', 'personal_beauty_skin', 'confidence', 0.88);
    elsif v_text ~ '(detergent|cleaning|tissue|toilet roll|washmittel|洗衣液|清洁剂|纸巾)' then
      return jsonb_build_object('l1', 'personal', 'l2', 'personal_wash', 'l3', 'personal_wash_clean', 'confidence', 0.88);
    end if;
    return jsonb_build_object('l1', 'personal', 'l2', 'personal_wash', 'l3', 'personal_wash_hair', 'confidence', 0.86);
  end if;

  if v_type ~ '(BED|PILLOW|SHEET|RUG|CURTAIN|SOFA|CHAIR|TABLE|DESK|OTTOMAN|CABINET|SHELF|HEADBOARD|FURNITURE|KITCHEN|FLATWARE|DRINKING_CUP|LAMP|LIGHT|STORAGE|HANGER|HOOK|HOME|WALL_ART)'
    or v_text ~ '(furniture|chair|table|desk|bed|mattress|pillow|blanket|duvet|curtain|lamp|rug|shelf|storage|organizer|kitchenware|cookware|sheet|sofa|headboard|basket|whisk|cabinet|hanger|mirror|toilet|bathroom|shower|家具|椅|桌|床|床垫|枕|被|窗帘|灯|地毯|置物架|收纳|锅|杯|沙发|床头板|衣架|镜|浴室|花洒)' then
    if v_text ~ '(bed|mattress|pillow|blanket|duvet|sheet|curtain|rug|床|床垫|枕|被|床单|窗帘|地毯)' then
      return jsonb_build_object('l1', 'home', 'l2', 'home_furniture', 'l3', 'home_furniture_bedding', 'confidence', 0.9);
    elsif v_text ~ '(kitchenware|cookware|pan|whisk|cup|glass|mug|bottle|flatware|锅|杯|餐具)' then
      return jsonb_build_object('l1', 'home', 'l2', 'home_kitchen', 'l3', 'home_kitchen_tableware', 'confidence', 0.88);
    elsif v_text ~ '(storage|organizer|basket|hanger|rack|ironing board|收纳|置物架|篮|衣架|熨衣板)' then
      return jsonb_build_object('l1', 'home', 'l2', 'home_storage', 'l3', 'home_storage_organize', 'confidence', 0.88);
    end if;
    return jsonb_build_object('l1', 'home', 'l2', 'home_furniture', 'l3', 'home_furniture_furniture', 'confidence', 0.86);
  end if;

  if v_text ~ '(gift|festival|hamper|礼盒|礼品|节日)' then
    return jsonb_build_object('l1', 'welfare', 'l2', 'welfare_gift', 'l3', 'welfare_gift_festival', 'confidence', 0.86);
  end if;
  return jsonb_build_object('l1', 'welfare', 'l2', 'welfare_review', 'l3', 'welfare_review_unclassified', 'confidence', 0.8);
end;
$$;

create or replace function public.apply_abo_product_taxonomy()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_path jsonb;
begin
  if new.supplier_id <> 'supplier-test-abo' or new.is_test is not true then
    return new;
  end if;
  v_path := public.classify_abo_product_taxonomy(new.name, new.subtitle, new.detail_json);
  new.taxonomy_l1 := v_path->>'l1';
  new.taxonomy_l2 := v_path->>'l2';
  new.taxonomy_l3 := v_path->>'l3';
  new.category_code := v_path->>'l1';
  new.classification_status := 'machine_classified';
  new.classification_confidence := (v_path->>'confidence')::numeric;
  new.taxonomy_version := '2026.08';
  return new;
end;
$$;

drop trigger if exists trg_products_abo_taxonomy on public.products;
create trigger trg_products_abo_taxonomy
before insert or update of name, subtitle, detail_json, supplier_id, is_test
on public.products for each row execute function public.apply_abo_product_taxonomy();

with classified as (
  select p.id, public.classify_abo_product_taxonomy(p.name, p.subtitle, p.detail_json) as path
  from public.products p
  where p.supplier_id = 'supplier-test-abo' and p.is_test = true
)
update public.products p
set taxonomy_l1 = c.path->>'l1',
    taxonomy_l2 = c.path->>'l2',
    taxonomy_l3 = c.path->>'l3',
    category_code = c.path->>'l1',
    classification_status = 'machine_classified',
    classification_confidence = (c.path->>'confidence')::numeric,
    taxonomy_version = '2026.08',
    updated_at = now()
from classified c
where p.id = c.id;

insert into public.catalog_review_queue (
  id, product_id, queue_type, suggested_taxonomy_l1, suggested_taxonomy_l2,
  suggested_taxonomy_l3, confidence
)
select 'review-classification-' || p.id, p.id,
  case when p.translation_status = 'pending' then 'both' else 'classification' end,
  p.taxonomy_l1,
  p.taxonomy_l2, p.taxonomy_l3, p.classification_confidence
from public.products p
where p.supplier_id = 'supplier-test-abo' and p.is_test = true
  and p.taxonomy_l3 = 'welfare_review_unclassified'
on conflict (product_id) do update set
  queue_type = excluded.queue_type,
  suggested_taxonomy_l1 = excluded.suggested_taxonomy_l1,
  suggested_taxonomy_l2 = excluded.suggested_taxonomy_l2,
  suggested_taxonomy_l3 = excluded.suggested_taxonomy_l3,
  confidence = excluded.confidence,
  status = 'pending';

create or replace function public.api_public_catalog_window(
  p_mall_slug text,
  p_limit integer default 200,
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
  with eligible as (
    select p.id, s.id as sku_id, coalesce(p.name_zh, p.name) as name,
      p.name_en, p.name_zh, coalesce(p.subtitle_zh, p.subtitle) as subtitle,
      p.subtitle_en, p.subtitle_zh, p.taxonomy_l1 as category_code,
      p.taxonomy_l1, p.taxonomy_l2, p.taxonomy_l3, p.classification_status,
      p.cover_url, s.price_cents, s.market_price_cents,
      i.available_qty - i.reserved_qty as available_stock,
      supplier.name as supplier_name, p.is_test, p.created_at,
      row_number() over (
        partition by p.taxonomy_l1 order by p.created_at desc, s.id
      ) as category_rank,
      case p.taxonomy_l1
        when 'food' then 1 when 'appliance' then 2 when 'digital' then 3
        when 'home' then 4 when 'personal' then 5 when 'welfare' then 6
        else 99
      end as category_order
    from public.products p
    join public.malls m on m.id = p.mall_id
    join public.skus s on s.product_id = p.id and s.mall_id = p.mall_id
    join public.inventory i on i.sku_id = s.id and i.mall_id = p.mall_id
    join public.suppliers supplier on supplier.id = p.supplier_id
    where m.public_slug = p_mall_slug
      and p.taxonomy_l1 in ('food', 'appliance', 'digital', 'home', 'personal', 'welfare')
      and public.is_valid_catalog_taxonomy_path(p.taxonomy_l1, p.taxonomy_l2, p.taxonomy_l3)
      and p.classification_confidence >= 0.8
      and p.status = 'active' and s.status = 'active' and m.status = 'active'
  )
  select e.id, e.sku_id, e.name, e.name_en, e.name_zh, e.subtitle,
    e.subtitle_en, e.subtitle_zh, e.category_code, e.taxonomy_l1,
    e.taxonomy_l2, e.taxonomy_l3, e.classification_status, e.cover_url,
    e.price_cents, e.market_price_cents, e.available_stock,
    e.supplier_name, e.is_test
  from eligible e
  order by e.category_rank, e.category_order, e.created_at desc, e.sku_id
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

revoke all on function public.api_public_catalog_window(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.api_public_catalog_window(text, integer, integer)
  to service_role;

do $$
begin
  if public.classify_abo_product_taxonomy('Organic coffee pods', '', '{}'::jsonb)->>'l1' <> 'food'
    or public.classify_abo_product_taxonomy('Portable blender', '', '{}'::jsonb)->>'l1' <> 'appliance'
    or public.classify_abo_product_taxonomy('USB phone charger', '', '{}'::jsonb)->>'l1' <> 'digital'
    or public.classify_abo_product_taxonomy('Cotton fitted sheet', '', '{}'::jsonb)->>'l1' <> 'home'
    or public.classify_abo_product_taxonomy('Lavender soap', '', '{}'::jsonb)->>'l1' <> 'personal'
    or public.classify_abo_product_taxonomy('Employee festival gift', '', '{}'::jsonb)->>'l1' <> 'welfare' then
    raise exception 'ABO taxonomy classifier self-check failed';
  end if;
end;
$$;
