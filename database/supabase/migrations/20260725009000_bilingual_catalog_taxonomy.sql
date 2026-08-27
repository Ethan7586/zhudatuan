alter table public.products
  add column if not exists name_en text,
  add column if not exists name_zh text,
  add column if not exists subtitle_en text,
  add column if not exists subtitle_zh text,
  add column if not exists translation_status text not null default 'pending'
    check (translation_status in ('pending', 'machine_translated', 'reviewed', 'source_provided')),
  add column if not exists translation_confidence numeric(4,3) not null default 0
    check (translation_confidence >= 0 and translation_confidence <= 1),
  add column if not exists taxonomy_l1 text,
  add column if not exists taxonomy_l2 text,
  add column if not exists taxonomy_l3 text,
  add column if not exists classification_status text not null default 'pending'
    check (classification_status in ('pending', 'machine_classified', 'reviewed', 'source_provided')),
  add column if not exists classification_confidence numeric(4,3) not null default 0
    check (classification_confidence >= 0 and classification_confidence <= 1);

comment on column public.products.name_en is 'Immutable supplier/source title in English or original language.';
comment on column public.products.name_zh is 'Chinese display title. Never overwrite source name.';
comment on column public.products.taxonomy_l1 is 'Smart Wing standard level-one taxonomy code.';

update public.products
set name_en = coalesce(name_en, name),
    subtitle_en = coalesce(subtitle_en, subtitle)
where name_en is null or subtitle_en is null;

with source_data as (
  select id, lower(concat_ws(' ', name_en, subtitle_en, detail_json->>'model', detail_json->>'productType', detail_json->>'description')) as source_text
  from public.products
  where is_test = true
), classified as (
  select id,
    case
      when source_text ~ '(rice|flour|pasta|cereal|oil|sauce|spice)' then 'food_grain'
      when source_text ~ '(coffee|tea|milk|juice|beverage|wine|beer)' then 'food_drink'
      when source_text ~ '(snack|chocolate|cookie|candy|food|grocery)' then 'food_snack'
      when source_text ~ '(microwave|oven|blender|mixer|coffee maker|kettle|toaster)' then 'appliance_kitchen'
      when source_text ~ '(vacuum|purifier|refrigerator|washer|dryer|conditioner|fan|heater|appliance)' then 'appliance_living'
      when source_text ~ '(laptop|notebook|monitor|keyboard|mouse|printer|computer|usb|router)' then 'digital_computer'
      when source_text ~ '(camera|phone|tablet|headphone|speaker|electronic|digital|battery)' then 'digital_audio'
      when source_text ~ '(office|paper|pen|stationery|software)' then 'digital_office'
      when source_text ~ '(chair|table|desk|bed|mattress|pillow|blanket|curtain|rug|shelf|furniture|bedding)' then 'home_furniture'
      when source_text ~ '(kitchenware|cookware|plate|glass|mug|bottle)' then 'home_kitchen'
      when source_text ~ '(lamp|storage|organizer|home decor)' then 'home_storage'
      when source_text ~ '(skin|beauty|cosmetic|makeup|lotion|razor|shave)' then 'personal_beauty'
      when source_text ~ '(shampoo|conditioner|soap|tooth|dental|deodorant|tissue|cleaning|detergent)' then 'personal_wash'
      when source_text ~ '(baby|toy|pet)' then 'supermarket_family'
      when source_text ~ '(garden|outdoor|sport|luggage|clothing|shoe|automotive|tool)' then 'supermarket_outdoor'
      when source_text ~ '(gift|festival|hamper)' then 'welfare_gift'
      else 'welfare_review'
    end as taxonomy_l2
  from source_data
)
update public.products product
set taxonomy_l1 = split_part(classified.taxonomy_l2, '_', 1),
    taxonomy_l2 = classified.taxonomy_l2,
    taxonomy_l3 = null,
    classification_status = 'machine_classified',
    classification_confidence = case when classified.taxonomy_l2 = 'welfare_review' then 0.35 else 0.72 end,
    category_code = case
      when classified.taxonomy_l2 like 'food_%' then 'food'
      when classified.taxonomy_l2 like 'appliance_%' then 'appliance'
      when classified.taxonomy_l2 like 'digital_%' then 'digital'
      when classified.taxonomy_l2 like 'home_%' then 'home'
      when classified.taxonomy_l2 like 'personal_%' then 'personal'
      when classified.taxonomy_l2 like 'supermarket_%' then 'supermarket'
      else 'welfare'
    end,
    updated_at = now()
from classified
where product.id = classified.id;

create index if not exists idx_products_taxonomy_review
  on public.products (mall_id, taxonomy_l1, taxonomy_l2, classification_status);
