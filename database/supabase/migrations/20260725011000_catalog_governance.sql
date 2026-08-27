create table if not exists public.catalog_taxonomy_nodes (
  code text primary key,
  parent_code text references public.catalog_taxonomy_nodes(code),
  level smallint not null check (level between 1 and 3),
  name_zh text not null,
  name_en text not null,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  taxonomy_version text not null default '2026.07',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_supplier_category_mappings (
  id text primary key,
  supplier_id text not null references public.suppliers(id),
  source_category_code text,
  source_category_name text not null,
  target_taxonomy_code text not null references public.catalog_taxonomy_nodes(code),
  mapping_status text not null default 'reviewed' check (mapping_status in ('draft', 'reviewed', 'disabled')),
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, source_category_name)
);

create table if not exists public.catalog_classification_rules (
  id text primary key,
  taxonomy_version text not null default '2026.07',
  rule_name text not null,
  source_field text not null check (source_field in ('source_category', 'title', 'brand', 'attributes')),
  match_pattern text not null,
  target_taxonomy_code text not null references public.catalog_taxonomy_nodes(code),
  priority integer not null default 100,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_review_queue (
  id text primary key,
  product_id text not null unique references public.products(id) on delete cascade,
  queue_type text not null check (queue_type in ('classification', 'translation', 'both')),
  suggested_taxonomy_l1 text,
  suggested_taxonomy_l2 text,
  suggested_taxonomy_l3 text,
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  status text not null default 'pending' check (status in ('pending', 'assigned', 'approved', 'rejected')),
  reviewer_id text references public.users(id),
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.products add column if not exists taxonomy_version text not null default '2026.07';

insert into public.catalog_taxonomy_nodes (code, parent_code, level, name_zh, name_en, sort_order) values
  ('food', null, 1, '食品饮料', 'Food & Beverage', 10),
  ('appliance', null, 1, '家用电器', 'Home Appliances', 20),
  ('digital', null, 1, '数码办公', 'Digital & Office', 30),
  ('home', null, 1, '家居日用', 'Home & Living', 40),
  ('personal', null, 1, '个护清洁', 'Personal Care', 50),
  ('supermarket', null, 1, '商超商品', 'General Merchandise', 60),
  ('welfare', null, 1, '企业福利专区', 'Enterprise Welfare', 70),
  ('service', null, 1, '权益与本地生活', 'Services & Benefits', 80),
  ('food_grain', 'food', 2, '米面粮油', 'Grain & Oil', 10),
  ('food_snack', 'food', 2, '休闲零食', 'Snacks', 20),
  ('food_drink', 'food', 2, '茶饮乳品', 'Drinks & Dairy', 30),
  ('appliance_kitchen', 'appliance', 2, '厨房电器', 'Kitchen Appliances', 10),
  ('appliance_living', 'appliance', 2, '生活电器', 'Living Appliances', 20),
  ('digital_computer', 'digital', 2, '电脑及外设', 'Computers & Peripherals', 10),
  ('digital_audio', 'digital', 2, '影音数码', 'Audio & Digital', 20),
  ('digital_office', 'digital', 2, '办公设备', 'Office Equipment', 30),
  ('home_furniture', 'home', 2, '家具家纺', 'Furniture & Bedding', 10),
  ('home_kitchen', 'home', 2, '厨具水具', 'Kitchenware', 20),
  ('home_storage', 'home', 2, '收纳清洁', 'Storage & Cleaning', 30),
  ('personal_beauty', 'personal', 2, '美妆护肤', 'Beauty & Skincare', 10),
  ('personal_wash', 'personal', 2, '洗护清洁', 'Personal Hygiene', 20),
  ('supermarket_office', 'supermarket', 2, '文具办公', 'Stationery', 10),
  ('supermarket_family', 'supermarket', 2, '母婴玩具宠物', 'Family, Toys & Pets', 20),
  ('supermarket_outdoor', 'supermarket', 2, '运动户外汽配', 'Outdoor & Automotive', 30),
  ('welfare_gift', 'welfare', 2, '节日礼赠', 'Festival Gifts', 10),
  ('welfare_care', 'welfare', 2, '员工关怀', 'Employee Care', 20),
  ('welfare_review', 'welfare', 2, '待人工归类', 'Manual Review Required', 99),
  ('service_virtual', 'service', 2, '虚拟卡券', 'Digital Vouchers', 10),
  ('service_movie', 'service', 2, '电影演出', 'Entertainment', 20),
  ('service_local', 'service', 2, '附近门店核销', 'Local Redemption', 30)
on conflict (code) do update set name_zh = excluded.name_zh, name_en = excluded.name_en, updated_at = now();

insert into public.catalog_taxonomy_nodes (code, parent_code, level, name_zh, name_en, sort_order) values
  ('food_grain_rice', 'food_grain', 3, '大米杂粮', 'Rice & Grains', 10),
  ('food_grain_oil', 'food_grain', 3, '食用油调味', 'Oil & Seasoning', 20),
  ('food_snack_nuts', 'food_snack', 3, '坚果零食', 'Nuts & Snacks', 10),
  ('food_drink_coffee_tea', 'food_drink', 3, '咖啡茶饮', 'Coffee & Tea', 10),
  ('food_drink_dairy', 'food_drink', 3, '乳品饮料', 'Dairy & Beverages', 20),
  ('appliance_kitchen_cook', 'appliance_kitchen', 3, '烹饪电器', 'Cooking Appliances', 10),
  ('appliance_living_clean', 'appliance_living', 3, '清洁电器', 'Cleaning Appliances', 10),
  ('appliance_living_air', 'appliance_living', 3, '空气与环境电器', 'Air & Climate Appliances', 20),
  ('digital_computer_pc', 'digital_computer', 3, '电脑整机', 'Computers', 10),
  ('digital_computer_peripheral', 'digital_computer', 3, '电脑外设', 'Computer Peripherals', 20),
  ('digital_audio_mobile', 'digital_audio', 3, '手机数码', 'Mobile Devices', 10),
  ('digital_audio_audio', 'digital_audio', 3, '耳机音箱', 'Audio Devices', 20),
  ('digital_office_stationery', 'digital_office', 3, '办公文具', 'Office Supplies', 10),
  ('home_furniture_bedding', 'home_furniture', 3, '床品家纺', 'Bedding & Textiles', 10),
  ('home_furniture_furniture', 'home_furniture', 3, '家具灯具', 'Furniture & Lighting', 20),
  ('home_kitchen_tableware', 'home_kitchen', 3, '餐厨水具', 'Tableware & Drinkware', 10),
  ('home_storage_organize', 'home_storage', 3, '收纳整理', 'Organization', 10),
  ('personal_beauty_skin', 'personal_beauty', 3, '护肤美妆', 'Skincare & Beauty', 10),
  ('personal_wash_hair', 'personal_wash', 3, '洗护用品', 'Hair & Body Care', 10),
  ('personal_wash_clean', 'personal_wash', 3, '家庭清洁', 'Household Cleaning', 20),
  ('supermarket_office_paper', 'supermarket_office', 3, '纸品文具', 'Paper & Stationery', 10),
  ('supermarket_family_toys', 'supermarket_family', 3, '玩具母婴宠物', 'Toys, Baby & Pets', 10),
  ('supermarket_outdoor_sports', 'supermarket_outdoor', 3, '运动户外', 'Sports & Outdoor', 10),
  ('supermarket_outdoor_auto', 'supermarket_outdoor', 3, '汽车工具', 'Automotive & Tools', 20),
  ('welfare_gift_festival', 'welfare_gift', 3, '节日礼盒', 'Festival Gift Sets', 10),
  ('welfare_care_employee', 'welfare_care', 3, '员工关怀', 'Employee Care', 10),
  ('welfare_review_unclassified', 'welfare_review', 3, '待审核商品', 'Unclassified Items', 10),
  ('service_virtual_card', 'service_virtual', 3, '商超与品牌卡券', 'Retail & Brand Vouchers', 10),
  ('service_movie_ticket', 'service_movie', 3, '电影票与演出', 'Tickets & Events', 10),
  ('service_local_redemption', 'service_local', 3, '到店核销服务', 'In-store Redemption', 10)
on conflict (code) do update set name_zh = excluded.name_zh, name_en = excluded.name_en, updated_at = now();

insert into public.catalog_classification_rules (id, rule_name, source_field, match_pattern, target_taxonomy_code, priority) values
  ('rule-title-air-purifier', '空气净化器', 'title', '(air purifier|purifier)', 'appliance_living_air', 10),
  ('rule-title-vacuum', '清洁电器', 'title', '(vacuum|robot vacuum)', 'appliance_living_clean', 20),
  ('rule-title-computer', '电脑整机', 'title', '(laptop|notebook|computer|monitor)', 'digital_computer_pc', 30),
  ('rule-title-peripheral', '电脑外设', 'title', '(keyboard|mouse|usb|router)', 'digital_computer_peripheral', 40),
  ('rule-title-coffee-tea', '咖啡茶饮', 'title', '(coffee|tea)', 'food_drink_coffee_tea', 50),
  ('rule-title-rice-grain', '米面粮油', 'title', '(rice|grain|cereal)', 'food_grain_rice', 60),
  ('rule-title-bedding', '床品家纺', 'title', '(pillow|blanket|mattress|bedding)', 'home_furniture_bedding', 70),
  ('rule-title-review', '低置信度待审核', 'attributes', 'unclassified', 'welfare_review_unclassified', 999)
on conflict (id) do update set rule_name = excluded.rule_name, match_pattern = excluded.match_pattern,
  target_taxonomy_code = excluded.target_taxonomy_code, priority = excluded.priority, updated_at = now();

with classified as (
  select id, taxonomy_l1, taxonomy_l2,
    case
      when taxonomy_l2 = 'food_grain' and lower(name_en) ~ '(rice|grain|cereal)' then 'food_grain_rice'
      when taxonomy_l2 = 'food_grain' then 'food_grain_oil'
      when taxonomy_l2 = 'food_snack' then 'food_snack_nuts'
      when taxonomy_l2 = 'food_drink' and lower(name_en) ~ '(coffee|tea)' then 'food_drink_coffee_tea'
      when taxonomy_l2 = 'food_drink' then 'food_drink_dairy'
      when taxonomy_l2 = 'appliance_kitchen' then 'appliance_kitchen_cook'
      when taxonomy_l2 = 'appliance_living' and lower(name_en) ~ '(purifier|air|conditioner|fan|heater)' then 'appliance_living_air'
      when taxonomy_l2 = 'appliance_living' then 'appliance_living_clean'
      when taxonomy_l2 = 'digital_computer' and lower(name_en) ~ '(laptop|notebook|computer|monitor)' then 'digital_computer_pc'
      when taxonomy_l2 = 'digital_computer' then 'digital_computer_peripheral'
      when taxonomy_l2 = 'digital_audio' and lower(name_en) ~ '(phone|tablet|camera)' then 'digital_audio_mobile'
      when taxonomy_l2 = 'digital_audio' then 'digital_audio_audio'
      when taxonomy_l2 = 'digital_office' then 'digital_office_stationery'
      when taxonomy_l2 = 'home_furniture' and lower(name_en) ~ '(bed|mattress|pillow|blanket|curtain|bedding)' then 'home_furniture_bedding'
      when taxonomy_l2 = 'home_furniture' then 'home_furniture_furniture'
      when taxonomy_l2 = 'home_kitchen' then 'home_kitchen_tableware'
      when taxonomy_l2 = 'home_storage' then 'home_storage_organize'
      when taxonomy_l2 = 'personal_beauty' then 'personal_beauty_skin'
      when taxonomy_l2 = 'personal_wash' and lower(name_en) ~ '(clean|detergent|tissue)' then 'personal_wash_clean'
      when taxonomy_l2 = 'personal_wash' then 'personal_wash_hair'
      when taxonomy_l2 = 'supermarket_office' then 'supermarket_office_paper'
      when taxonomy_l2 = 'supermarket_family' then 'supermarket_family_toys'
      when taxonomy_l2 = 'supermarket_outdoor' and lower(name_en) ~ '(auto|car|tool)' then 'supermarket_outdoor_auto'
      when taxonomy_l2 = 'supermarket_outdoor' then 'supermarket_outdoor_sports'
      when taxonomy_l2 = 'welfare_gift' then 'welfare_gift_festival'
      when taxonomy_l2 = 'welfare_care' then 'welfare_care_employee'
      else 'welfare_review_unclassified'
    end as taxonomy_l3
  from public.products where is_test = true
)
update public.products p
set taxonomy_l1 = c.taxonomy_l1, taxonomy_l2 = c.taxonomy_l2, taxonomy_l3 = c.taxonomy_l3,
    taxonomy_version = '2026.07', updated_at = now()
from classified c where p.id = c.id;

insert into public.catalog_review_queue (
  id, product_id, queue_type, suggested_taxonomy_l1, suggested_taxonomy_l2, suggested_taxonomy_l3, confidence
)
select 'review-classification-' || p.id, p.id, 'both', p.taxonomy_l1, p.taxonomy_l2, p.taxonomy_l3,
  least(p.classification_confidence, p.translation_confidence)
from public.products p
where p.is_test = true and (p.classification_confidence < 0.6 or p.translation_status = 'pending')
on conflict (product_id) do update set
  suggested_taxonomy_l1 = excluded.suggested_taxonomy_l1,
  suggested_taxonomy_l2 = excluded.suggested_taxonomy_l2,
  suggested_taxonomy_l3 = excluded.suggested_taxonomy_l3,
  confidence = excluded.confidence;

create index if not exists idx_catalog_review_queue_pending
  on public.catalog_review_queue (status, queue_type, confidence, created_at);

create or replace function public.api_catalog_governance_summary()
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'taxonomyVersion', '2026.07',
    'products', (select count(*) from public.products),
    'translatedProducts', (select count(*) from public.products where name_zh is not null),
    'pendingTranslation', (select count(*) from public.products where translation_status = 'pending'),
    'pendingClassificationReview', (select count(*) from public.catalog_review_queue where status = 'pending' and queue_type in ('classification', 'both')),
    'taxonomyNodes', (select count(*) from public.catalog_taxonomy_nodes where status = 'active')
  );
$$;

revoke all on function public.api_catalog_governance_summary() from public, anon, authenticated;
grant execute on function public.api_catalog_governance_summary() to service_role;
