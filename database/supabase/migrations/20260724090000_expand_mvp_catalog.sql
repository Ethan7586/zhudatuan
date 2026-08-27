insert into public.products (
  id, tenant_id, mall_id, supplier_id, spu_code, name, subtitle,
  category_code, cover_url, status
) values
  (
    'p_101', 'tenant-smart-wing', 'mall-demo', 'supplier-central', 'SPU-MVP-RICE-10KG',
    '【集团专享】柴火大院核心产区五常有机大米10kg',
    '原产地直供，企业劳保福利严选',
    'food',
    'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
    'active'
  ),
  (
    'p_102', 'tenant-smart-wing', 'mall-demo', 'supplier-central', 'SPU-MVP-OLIVE-OIL',
    '欧丽薇兰特级初榨橄榄油双瓶礼盒',
    '西班牙原瓶进口，健康油脂礼赠优选',
    'food',
    'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80',
    'active'
  ),
  (
    'p_103', 'tenant-smart-wing', 'mall-demo', 'supplier-central', 'SPU-MVP-NUTS',
    '三只松鼠每日坚果企业福利礼盒',
    '多种纯坚果组合，员工关怀礼赠',
    'food',
    'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600&auto=format&fit=crop&q=80',
    'active'
  ),
  (
    'p_104', 'tenant-smart-wing', 'mall-demo', 'supplier-central', 'SPU-MVP-TEA',
    '明前特级西湖龙井茶瓷罐礼盒',
    '核心产区手工炒制，商务礼赠',
    'food',
    'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
    'active'
  ),
  (
    'p_201', 'tenant-smart-wing', 'mall-demo', 'supplier-central', 'SPU-MVP-DYSON-V12',
    '戴森V12 Detect Slim无线手持吸尘器',
    '激光探测微尘，国行正品联保',
    'appliance',
    'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&auto=format&fit=crop&q=80',
    'active'
  ),
  (
    'p_202', 'tenant-smart-wing', 'mall-demo', 'supplier-central', 'SPU-MVP-AIR-FRYER',
    '九阳5.5L大容量可视空气炸锅',
    '热风循环免翻面，健康家用',
    'appliance',
    'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
    'active'
  ),
  (
    'p_301', 'tenant-smart-wing', 'mall-demo', 'supplier-central', 'SPU-MVP-KEYBOARD',
    '罗技G610红轴全尺寸机械键盘',
    '办公游戏双宜，企业数码福利',
    'digital',
    'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
    'active'
  ),
  (
    'p_701', 'tenant-smart-wing', 'mall-demo', 'supplier-local', 'SPU-MVP-COFFEE-CARD',
    '星巴克100元电子星礼卡',
    '支付成功后即时发放，企业员工专享',
    'virtual-card',
    'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&auto=format&fit=crop&q=80',
    'active'
  )
on conflict (id) do update set
  name = excluded.name,
  subtitle = excluded.subtitle,
  category_code = excluded.category_code,
  cover_url = excluded.cover_url,
  status = excluded.status,
  updated_at = now();

insert into public.skus (
  id, tenant_id, mall_id, product_id, sku_code, specs_json,
  price_cents, market_price_cents, status
) values
  ('sku-p-101', 'tenant-smart-wing', 'mall-demo', 'p_101', 'SKU-MVP-RICE-10KG',
   '{"规格":"10kg/袋"}'::jsonb, 9800, 15800, 'active'),
  ('sku-p-102', 'tenant-smart-wing', 'mall-demo', 'p_102', 'SKU-MVP-OLIVE-OIL',
   '{"规格":"750ml*2礼盒"}'::jsonb, 16800, 26800, 'active'),
  ('sku-p-103', 'tenant-smart-wing', 'mall-demo', 'p_103', 'SKU-MVP-NUTS',
   '{"规格":"1580g礼盒"}'::jsonb, 10800, 19800, 'active'),
  ('sku-p-104', 'tenant-smart-wing', 'mall-demo', 'p_104', 'SKU-MVP-TEA',
   '{"规格":"250g瓷罐礼盒"}'::jsonb, 36000, 68000, 'active'),
  ('sku-p-201', 'tenant-smart-wing', 'mall-demo', 'p_201', 'SKU-MVP-DYSON-V12',
   '{"颜色":"金色"}'::jsonb, 329900, 449900, 'active'),
  ('sku-p-202', 'tenant-smart-wing', 'mall-demo', 'p_202', 'SKU-MVP-AIR-FRYER',
   '{"容量":"5.5L"}'::jsonb, 21900, 39900, 'active'),
  ('sku-p-301', 'tenant-smart-wing', 'mall-demo', 'p_301', 'SKU-MVP-KEYBOARD',
   '{"轴体":"红轴"}'::jsonb, 35900, 59900, 'active'),
  ('sku-p-701', 'tenant-smart-wing', 'mall-demo', 'p_701', 'SKU-MVP-COFFEE-CARD',
   '{"面值":"100元"}'::jsonb, 9800, 10000, 'active')
on conflict (id) do update set
  specs_json = excluded.specs_json,
  price_cents = excluded.price_cents,
  market_price_cents = excluded.market_price_cents,
  status = excluded.status,
  updated_at = now();

insert into public.inventory (
  tenant_id, mall_id, sku_id, available_qty, reserved_qty
) values
  ('tenant-smart-wing', 'mall-demo', 'sku-p-101', 2450, 0),
  ('tenant-smart-wing', 'mall-demo', 'sku-p-102', 890, 0),
  ('tenant-smart-wing', 'mall-demo', 'sku-p-103', 3100, 0),
  ('tenant-smart-wing', 'mall-demo', 'sku-p-104', 450, 0),
  ('tenant-smart-wing', 'mall-demo', 'sku-p-201', 120, 0),
  ('tenant-smart-wing', 'mall-demo', 'sku-p-202', 1500, 0),
  ('tenant-smart-wing', 'mall-demo', 'sku-p-301', 420, 0),
  ('tenant-smart-wing', 'mall-demo', 'sku-p-701', 10000, 0)
on conflict (sku_id) do update set
  available_qty = excluded.available_qty,
  updated_at = now();
