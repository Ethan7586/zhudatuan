insert into public.catalog_taxonomy_nodes (code, parent_code, level, name_zh, name_en, sort_order) values
  ('apparel', null, 1, '服饰鞋包', 'Fashion & Accessories', 65),
  ('digital_mobile', 'digital', 2, '手机通讯', 'Mobile & Communication', 25),
  ('digital_mobile_accessory', 'digital_mobile', 3, '手机配件', 'Mobile Accessories', 10),
  ('apparel_footwear', 'apparel', 2, '鞋靴服饰', 'Footwear & Apparel', 10),
  ('apparel_footwear_shoes', 'apparel_footwear', 3, '鞋靴', 'Shoes & Boots', 10),
  ('apparel_bags', 'apparel', 2, '箱包配饰', 'Bags & Accessories', 20),
  ('apparel_bags_bag', 'apparel_bags', 3, '箱包', 'Bags', 10),
  ('apparel_jewelry', 'apparel', 2, '珠宝饰品', 'Jewelry', 30),
  ('apparel_jewelry_fine', 'apparel_jewelry', 3, '珠宝首饰', 'Fine Jewelry', 10)
on conflict (code) do update set name_zh = excluded.name_zh, name_en = excluded.name_en, updated_at = now();

with source_types as (
  select distinct trim(detail_json->>'productType') as source_category_name
  from public.products
  where is_test = true and coalesce(detail_json->>'productType', '') <> ''
), mapped as (
  select source_category_name,
    case
      when source_category_name ~ '(CELLULAR_PHONE_CASE|PORTABLE_ELECTRONIC_DEVICE_COVER|PORTABLE_ELECTRONIC_DEVICE_MOUNT|WIRELESS_ACCESSORY|CHARGING_ADAPTER)' then 'digital_mobile_accessory'
      when source_category_name ~ '(HEADPHONES|SPEAKERS|MICROPHONE|CAMERA)' then 'digital_audio_audio'
      when source_category_name ~ '(COMPUTER|OFFICE_ELECTRONICS|OFFICE_PRODUCTS|WRITING_INSTRUMENT|STORAGE_BINDER)' then 'digital_office_stationery'
      when source_category_name ~ '(GROCERY|COFFEE|HERB|SNACK|FOOD)' then 'food_snack_nuts'
      when source_category_name ~ '(SHOES|SANDAL|BOOT)' then 'apparel_footwear_shoes'
      when source_category_name ~ '(HANDBAG|BACKPACK|SUITCASE|LUGGAGE|WALLET|HAT|ACCESSORY)' then 'apparel_bags_bag'
      when source_category_name ~ '(RING|EARRING|NECKLACE|BRACELET)' then 'apparel_jewelry_fine'
      when source_category_name ~ '(BED|PILLOW|SHEET|RUG|CURTAIN|SOFA|CHAIR|TABLE|DESK|OTTOMAN|CABINET|SHELF|HEADBOARD|FURNITURE)' then 'home_furniture_furniture'
      when source_category_name ~ '(KITCHEN|FLATWARE|DRINKING_CUP)' then 'home_kitchen_tableware'
      when source_category_name ~ '(LAMP|LIGHT|STORAGE|HANGER|HOOK|HOME|WALL_ART)' then 'home_storage_organize'
      when source_category_name ~ '(BEAUTY|SKIN|HEALTH_PERSONAL_CARE|NUTRITIONAL_SUPPLEMENT)' then 'personal_beauty_skin'
      when source_category_name ~ '(JANITORIAL|CLEANING|DRUGSTORE)' then 'personal_wash_clean'
      when source_category_name ~ '(PET|BABY|TOY)' then 'supermarket_family_toys'
      when source_category_name ~ '(SPORT|OUTDOOR)' then 'supermarket_outdoor_sports'
      when source_category_name ~ '(AUTO|TOOLS|HARDWARE|PLUMBING|SAFETY)' then 'supermarket_outdoor_auto'
      else null
    end as target_taxonomy_code
  from source_types
)
insert into public.catalog_supplier_category_mappings (
  id, supplier_id, source_category_code, source_category_name, target_taxonomy_code, mapping_status, confidence
)
select 'map-abo-' || md5(source_category_name), 'supplier-test-abo', source_category_name, source_category_name,
  target_taxonomy_code, 'reviewed', 0.88
from mapped where target_taxonomy_code is not null
on conflict (supplier_id, source_category_name) do update set
  target_taxonomy_code = excluded.target_taxonomy_code, confidence = excluded.confidence,
  mapping_status = 'reviewed', updated_at = now();

with resolved as (
  select p.id, leaf.code as taxonomy_l3, parent2.code as taxonomy_l2, parent1.code as taxonomy_l1
  from public.products p
  join public.catalog_supplier_category_mappings map
    on map.supplier_id = p.supplier_id
   and map.source_category_name = trim(p.detail_json->>'productType')
   and map.mapping_status = 'reviewed'
  join public.catalog_taxonomy_nodes leaf on leaf.code = map.target_taxonomy_code and leaf.level = 3
  join public.catalog_taxonomy_nodes parent2 on parent2.code = leaf.parent_code and parent2.level = 2
  join public.catalog_taxonomy_nodes parent1 on parent1.code = parent2.parent_code and parent1.level = 1
  where p.is_test = true
)
update public.products p
set taxonomy_l1 = r.taxonomy_l1, taxonomy_l2 = r.taxonomy_l2, taxonomy_l3 = r.taxonomy_l3,
    category_code = r.taxonomy_l1, classification_status = 'machine_classified',
    classification_confidence = 0.88, taxonomy_version = '2026.07', updated_at = now()
from resolved r where p.id = r.id;

update public.catalog_review_queue q
set queue_type = 'translation'
from public.products p
where q.product_id = p.id and q.status = 'pending'
  and p.classification_confidence >= 0.8 and p.translation_status = 'pending';

create or replace function public.api_catalog_governance_summary()
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'taxonomyVersion', '2026.07',
    'products', (select count(*) from public.products),
    'translatedProducts', (select count(*) from public.products where name_zh is not null),
    'pendingTranslation', (select count(*) from public.catalog_review_queue where status = 'pending' and queue_type in ('translation', 'both')),
    'pendingClassificationReview', (select count(*) from public.catalog_review_queue where status = 'pending' and queue_type in ('classification', 'both')),
    'highConfidenceClassified', (select count(*) from public.products where classification_confidence >= 0.8),
    'taxonomyNodes', (select count(*) from public.catalog_taxonomy_nodes where status = 'active')
  );
$$;
