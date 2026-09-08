import { Client } from 'pg';
import { localSeedEnvironment } from '@shop/config/server';
import { localSecret } from './LocalSecrets';
import { LOCAL_OWNER } from './LocalOwner';

const environment = localSeedEnvironment();
const database = new Client({ connectionString: await localSecret(environment.adminDatabaseConnectionRef) });
const products = Object.freeze([
  Object.freeze({ id: 'product:visual:care', sku: 'sku:visual:care', code: 'VISUAL-CARE', title: '暖心生活关怀礼盒', kind: 'physical', amount: 12_800, compare: 15_800, account: 'welfare' }),
  Object.freeze({ id: 'product:visual:meal', sku: 'sku:visual:meal', code: 'VISUAL-MEAL', title: '工作日营养餐券', kind: 'voucher', amount: 3_000, compare: 3_000, account: 'meal' }),
  Object.freeze({ id: 'product:visual:movie', sku: 'sku:visual:movie', code: 'VISUAL-MOVIE', title: '全国通兑电影票', kind: 'service', amount: 5_000, compare: 6_000, account: 'welfare' }),
] as const);

await database.connect();
try {
  await database.query('begin');
  await database.query(`insert into catalog.category(id,parent_id,code,name,status,sort_order)
    values('category:visual:benefit',null,'visual-benefit','员工精选','active',10)
    on conflict(id) do update set code=excluded.code,name=excluded.name,status='active',sort_order=excluded.sort_order`);
  for (const [index, product] of products.entries()) await ensureProduct(database, product, index);
  await assertVisualSeed(database);
  await database.query('commit');
  process.stdout.write(`LOCAL_VISUAL_SEEDED products=${products.length}\n`);
} catch (cause) {
  await database.query('rollback');
  throw cause;
} finally {
  await database.end();
}

async function ensureProduct(client: Client, product: (typeof products)[number], index: number): Promise<void> {
  const attributes = JSON.stringify({
    allowedAccounts: [product.account, 'cash'],
    deliverySla: product.kind === 'physical' ? '预计两个工作日送达' : '付款后即时到账',
    enterpriseExclusive: true,
    subtitleZh: index === 0 ? '把企业关怀送到员工手中' : index === 1 ? '工作日能量补给' : '热门影片随心选',
    tags: index === 0 ? ['企业严选', '暖心礼赠'] : index === 1 ? ['餐补可用'] : ['即时兑换'],
  });
  await client.query(
    `insert into catalog.product(id,owner_partner_id,brand_id,category_id,title,product_type,attributes,status,version,created_at,updated_at,scope_id)
    values($1,null,null,'category:visual:benefit',$2,$3,$4::jsonb,'active',1,'2026-01-01T00:00:00Z','2026-09-01T00:00:00Z',$5)
    on conflict(id) do update set category_id=excluded.category_id,title=excluded.title,product_type=excluded.product_type,
      attributes=excluded.attributes,status='active',scope_id=excluded.scope_id,updated_at=excluded.updated_at`,
    [product.id, product.title, product.kind, attributes, LOCAL_OWNER.mall]
  );
  await client.query(
    `insert into catalog.sku(id,product_id,code,specifications,status,version,scope_id)
    values($1,$2,$3,'{"规格":"标准款"}'::jsonb,'active',1,$4)
    on conflict(id) do update set product_id=excluded.product_id,code=excluded.code,specifications=excluded.specifications,
      status='active',scope_id=excluded.scope_id`,
    [product.sku, product.id, product.code, LOCAL_OWNER.mall]
  );
  await client.query(
    `insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at)
    values('pool-local-zhudatuan',$1,'included','visual-v1','2026-09-01T00:00:00Z')
    on conflict(pool_id,sku_id) do update set state='included',source_version='visual-v1'`,
    [product.sku]
  );
  await client.query(
    `insert into pricing.price(id,book_id,sku_id,amount_minor,compare_minor,effective_at,expires_at)
    values('price:visual:'||$1,'pricebook:local:zhudatuan',$1,$2,$3,'2026-01-01T00:00:00Z',null)
    on conflict(book_id,sku_id,effective_at) do update set amount_minor=excluded.amount_minor,compare_minor=excluded.compare_minor,expires_at=null`,
    [product.sku, product.amount, product.compare]
  );
  await client.query(
    `insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
    values('stock:visual:'||$1,$2,$1,'visual-main',100,5,1,'active','2026-09-01T00:00:00Z')
    on conflict(scope_id,sku_id,location_id) do update set onhand=100,safety=5,version=inventory.stockitem.version+1,
      status='active',updated_at=excluded.updated_at`,
    [product.sku, LOCAL_OWNER.mall]
  );
  await client.query(
    `insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,expires_at,version,created_at,updated_at)
    values('listing:mall-zhudatuan:'||$1,$2,'pool-local-zhudatuan',$1,$3,'published','2026-01-01T00:00:00Z',null,1,'2026-09-01T00:00:00Z','2026-09-01T00:00:00Z')
    on conflict(scope_id,sku_id) do update set pool_id='pool-local-zhudatuan',title=excluded.title,status='published',
      effective_at=excluded.effective_at,expires_at=null,updated_at=excluded.updated_at`,
    [product.sku, LOCAL_OWNER.mall, product.title]
  );
}

async function assertVisualSeed(client: Client): Promise<void> {
  const result = await client.query<{ count: number }>(`select count(distinct listing.id)::integer count from catalog.listing listing
    join catalog.poolbinding binding on binding.pool_id=listing.pool_id and binding.mall_id=$1 and binding.status='active'
    join pricing.price price on price.book_id='pricebook:local:zhudatuan' and price.sku_id=listing.sku_id
    join inventory.stockitem stock on stock.scope_id=$1 and stock.sku_id=listing.sku_id and stock.status='active'
    where listing.sku_id=any($2::text[]) and listing.status='published' and price.amount_minor>0 and stock.onhand>stock.safety`, [LOCAL_OWNER.mall, products.map(({ sku }) => sku)]);
  if (result.rows[0]?.count !== products.length) throw new Error(`LOCAL_VISUAL_SEED_INCOMPLETE:${result.rows[0]?.count ?? 0}`);
}
