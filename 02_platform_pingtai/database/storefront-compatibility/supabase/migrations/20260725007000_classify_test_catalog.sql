with classified as (
  select
    id,
    case
      when lower(concat_ws(' ', name, subtitle, detail_json->>'model', detail_json->>'productType', detail_json->>'description'))
        ~ '(food|grocery|beverage|snack|coffee|tea|cereal|pasta|sauce|chocolate|cookie|candy|rice|flour|spice|organic|milk|juice|wine|beer)' then 'food'
      when lower(concat_ws(' ', name, subtitle, detail_json->>'model', detail_json->>'productType', detail_json->>'description'))
        ~ '(computer|laptop|notebook|monitor|keyboard|mouse|printer|camera|phone|tablet|headphone|speaker|router|electronic|digital|usb|battery|software)' then 'digital'
      when lower(concat_ws(' ', name, subtitle, detail_json->>'model', detail_json->>'productType', detail_json->>'description'))
        ~ '(vacuum|air purifier|purifier|refrigerator|microwave|oven|blender|mixer|coffee maker|kettle|toaster|washer|dryer|conditioner|fan|heater|appliance)' then 'appliance'
      when lower(concat_ws(' ', name, subtitle, detail_json->>'model', detail_json->>'productType', detail_json->>'description'))
        ~ '(shampoo|conditioner|soap|tooth|dental|skin|beauty|cosmetic|makeup|razor|shave|deodorant|lotion|towel|tissue|cleaning|detergent)' then 'personal'
      when lower(concat_ws(' ', name, subtitle, detail_json->>'model', detail_json->>'productType', detail_json->>'description'))
        ~ '(furniture|chair|table|desk|bed|mattress|pillow|blanket|curtain|lamp|rug|shelf|storage|kitchenware|cookware|bedding|home decor)' then 'home'
      when lower(concat_ws(' ', name, subtitle, detail_json->>'model', detail_json->>'productType', detail_json->>'description'))
        ~ '(office|paper|pen|stationery|tool|garden|pet|baby|toy|automotive|outdoor|sport|luggage|clothing|shoe)' then 'supermarket'
      else 'welfare'
    end as category_code
  from public.products
  where is_test = true
)
update public.products product
set category_code = classified.category_code,
    updated_at = now()
from classified
where product.id = classified.id;
