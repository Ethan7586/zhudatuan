import { randomUUID } from 'node:crypto';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CatalogPartnerPort } from '../../../partner/public';
import type { ProductDetailBase, ProductRepository } from '../../application/port/ProductRepository';
import { Product, type ProductSnapshot } from '../../domain/model/Product';
import { Sku } from '../../domain/model/Sku';
import { Category, type CategorySnapshot } from '../../domain/model/Category';
import type { CatalogScopeReader } from './CatalogScopeReader';
interface ProductDetail extends Omit<ProductDetailBase, 'media' | 'regionIds' | 'timeline'> {
  readonly owner_partner_id: string | null;
  readonly attributes: Readonly<Record<string, unknown>>;
}
export class PgProductRepository implements ProductRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly scopes: CatalogScopeReader,
    private readonly partners: CatalogPartnerPort
  ) {}
  async detail(context: ReadTransactionContext, productId: string, scope: string, store: boolean) {
    const database = this.transactions.database(context);
    const allowedScopes = await this.scopes.visible(context, scope, store);
    const result = await database.query<ProductDetail>(
      `select product.id,product.title,product.product_type,product.status,product.version::text version,
        product.category_id,product.brand_id,product.owner_partner_id,
        product.attributes,product.attributes->>'coverUrl' cover_url,product.attributes->>'subtitle' subtitle,
        product.attributes->>'description' description,product.created_at "createdAt",product.updated_at "updatedAt",
        coalesce((select jsonb_agg(jsonb_build_object('id',sku.id,'code',sku.code,'status',sku.status,
          'specifications',coalesce((select jsonb_agg(jsonb_build_object('name',specification.key,'value',specification.value)
            order by specification.key) from jsonb_each_text(sku.specifications) specification),'[]'::jsonb),
          'version',sku.version::text) order by sku.code,sku.id) from catalog.sku sku
          where sku.product_id=product.id),'[]'::jsonb) skus,
        coalesce((select jsonb_agg(jsonb_build_object('id',listing.id,'scope',listing.scope_id,
          'pool',listing.pool_id,'sku',listing.sku_id,'title',listing.title,'status',listing.status,
          'effectiveAt',listing.effective_at,'expiresAt',listing.expires_at,'createdAt',listing.created_at,
          'updatedAt',listing.updated_at,'version',listing.version::text)
          order by listing.updated_at desc,listing.id) from catalog.listing listing
          where listing.sku_id in(select sku.id from catalog.sku sku where sku.product_id=product.id)
            and listing.scope_id=any($2::text[])),'[]'::jsonb) listings,
        coalesce((select jsonb_agg(jsonb_build_object('provider',source.provider,'externalId',source.external_id,
          'status',source.status,'sourceVersion',source.source_version,'observedAt',source.observed_at)
          order by source.observed_at desc,source.id) from catalog.sourcelisting source
          where source.sku_id in(select sku.id from catalog.sku sku where sku.product_id=product.id)),'[]'::jsonb) channels,
        coalesce((select jsonb_agg(jsonb_build_object('id',pooled.id,'name',pooled.name,'kind',pooled.kind,
          'status',pooled.status,'listingCount',pooled.listing_count) order by pooled.name,pooled.id) from(
          select pool.id,pool.name,pool.kind,pool.status,count(distinct listing.id)::integer listing_count
          from catalog.listing listing join catalog.pool pool on pool.id=listing.pool_id
          where listing.sku_id in(select sku.id from catalog.sku sku where sku.product_id=product.id)
            and listing.scope_id=any($2::text[]) group by pool.id,pool.name,pool.kind,pool.status
        ) pooled),'[]'::jsonb) pools
      from catalog.product product where product.id=$1`,
      [productId, allowedScopes]
    );
    const product = result.rows[0];
    if (!product) throw new DomainError('LISTING_NOT_PURCHASABLE');
    const ownerScope = product.owner_partner_id ? (await this.partners.scopes(context, [product.owner_partner_id])).get(product.owner_partner_id) ?? null : null;
    if (product.listings.length === 0 && (ownerScope === null || !allowedScopes.includes(ownerScope))) throw new DomainError('LISTING_NOT_PURCHASABLE');
    const media = productMedia(product.attributes, product.cover_url, product.title);
    const regionIds = textArray(product.attributes.regionIds);
    const timeline = productTimeline(product);
    const { attributes: _attributes, ...visible } = product;
    return Object.freeze({ ...visible, media, regionIds, timeline, visibleScopes: Object.freeze(allowedScopes) });
  }
  async create(context: WriteTransactionContext, input: Parameters<ProductRepository['create']>[1]) {
    const database = this.transactions.database(context);
    const suffix = randomUUID();
    const id = `product:${suffix}`;
    const sku = `sku:${suffix}`;
    const category = await this.category(database, input.category);
    const product = Product.create({ id, scope: input.scope, owner: input.owner, brand: input.brand, category, title: input.title, kind: input.kind, attributes: input.attributes }).snapshot();
    const createdSku = Sku.create({ id: sku, product: id, code: `LOCAL-${suffix}`, specifications: {} }).snapshot();
    const result = await database.query(
      `insert into catalog.product(id,scope_id,owner_partner_id,brand_id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,clock_timestamp(),clock_timestamp()) returning *`,
      [product.id, product.scope, product.owner, product.brand, product.category, product.title, product.kind, JSON.stringify(product.attributes), product.state, product.version]
    );
    await database.query(`insert into catalog.sku(id,scope_id,product_id,code,specifications,status,version) values($1,$2,$3,$4,$5::jsonb,$6,$7)`,
      [createdSku.id, input.scope, createdSku.product, createdSku.code, JSON.stringify(createdSku.specifications), createdSku.state, createdSku.version]);
    await database.query(
      `insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,expires_at,version,created_at,updated_at)
      values($1,$2,(select id from catalog.pool where scope_id=$2 and status='active' order by case kind when 'private' then 0 else 1 end,id limit 1),
      $3,$4,'draft',null,null,1,clock_timestamp(),clock_timestamp())`,
      [`listing:${suffix}`, input.scope, sku, input.title]
    );
    const created = result.rows[0];
    if (!created) throw new Error('CATALOG_PRODUCT_CREATE_FAILED');
    return Object.freeze({ ...created });
  }
  async update(context: WriteTransactionContext, input: Parameters<ProductRepository['update']>[1]) {
    const database = this.transactions.database(context);
    const visible = await this.scopes.visible(database.transaction, input.scope, false);
    const loaded = await database.query<Record<string, unknown>>(
      `select id,scope_id,owner_partner_id,brand_id,category_id,title,product_type,attributes,status,version::integer
       from catalog.product where id=$1 and scope_id=any($2::text[]) for update`,
      [input.id, visible]
    );
    if (!loaded.rows[0]) throw new DomainError('VERSION_CONFLICT');
    const category = input.category === null ? undefined : await this.category(database, input.category);
    const current = restore(loaded.rows[0]);
    const changed = Product.restore(current).change(
      {
        ...(input.title === null ? {} : { title: input.title }),
        ...(category === undefined ? {} : { category }),
        ...(input.attributes === null ? {} : { attributes: input.attributes }),
        ...(input.status === null ? {} : { state: input.status }),
      },
      input.expectedVersion
    ).snapshot();
    const result = await database.query(
      `update catalog.product set title=$2,category_id=$3,attributes=$4::jsonb,status=$5,version=$6,updated_at=clock_timestamp()
       where id=$1 and version=$7 returning *`,
      [changed.id, changed.title, changed.category, JSON.stringify(changed.attributes), changed.state, changed.version, input.expectedVersion]
    );
    const product = result.rows[0];
    if (!product) throw new DomainError('VERSION_CONFLICT');
    if (input.title !== null) {
      await database.query(`update catalog.listing listing set title=$2,updated_at=clock_timestamp() where listing.sku_id in(select sku.id from catalog.sku sku where sku.product_id=$1)`, [input.id, input.title]);
    }
    if (input.status === 'active') await database.query(`update catalog.sku set status='active',version=version+1 where product_id=$1 and status='draft'`, [input.id]);
    return Object.freeze({ ...product });
  }
  async archive(context: WriteTransactionContext, id: string, scope: string, expectedVersion: number) {
    const database = this.transactions.database(context);
    const visible = await this.scopes.visible(context, scope, false);
    const locked = await database.query<Record<string, unknown>>(
      `select id,scope_id,owner_partner_id,brand_id,category_id,title,product_type,attributes,status,version::integer
       from catalog.product where id=$1 and scope_id=any($2::text[]) for update`, [id, visible]
    );
    if (!locked.rows[0]) throw new DomainError('VERSION_CONFLICT');
    const archived = Product.restore(restore(locked.rows[0])).archive(expectedVersion).snapshot();
    const result = await database.query(`update catalog.product set status=$2,version=$3,updated_at=clock_timestamp() where id=$1 and version=$4 returning *`, [id, archived.state, archived.version, expectedVersion]);
    const product = result.rows[0];
    if (!product) throw new DomainError('VERSION_CONFLICT');
    return Object.freeze({ ...product });
  }
  private async category(database: ReturnType<PgTransactionAccess['database']>, value: string): Promise<string> {
    const category = value.trim();
    const result = await database.query<{ id: string; parent_id: string | null; code: string; name: string; status: CategorySnapshot['state']; sort_order: number }>(
      'select id,parent_id,code,name,status,sort_order from catalog.category where id=$1 or name=$1 order by case when id=$1 then 0 else 1 end limit 1', [category]
    );
    if (!result.rows[0]) throw new DomainError('VALIDATION_FAILED', { field: 'category' });
    const row = result.rows[0];
    return Category.restore({ id: row.id, parent: row.parent_id, code: row.code, name: row.name, state: row.status, sort: row.sort_order }).active().id;
  }
}

function productMedia(attributes: Readonly<Record<string, unknown>>, cover: string | null, title: string): ProductDetailBase['media'] {
  const candidates = Array.isArray(attributes.media) ? attributes.media : [];
  const values = candidates.flatMap((candidate, index) => {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const item = candidate as Readonly<Record<string, unknown>>;
    const kind = item.kind;
    const url = typeof item.url === 'string' && safeMediaUrl(item.url) ? item.url : null;
    if ((kind !== 'image' && kind !== 'video' && kind !== 'document') || url === null) return [];
    return [Object.freeze({ id: typeof item.id === 'string' && item.id !== '' ? item.id : `media:${index + 1}`, kind, url, alt: typeof item.alt === 'string' ? item.alt : null, sort: positiveInteger(item.sort, index) })];
  });
  if (cover !== null && safeMediaUrl(cover) && !values.some(({ url }) => url === cover)) values.unshift(Object.freeze({ id: 'media:cover', kind: 'image', url: cover, alt: title, sort: 0 }));
  return Object.freeze(values.sort((left, right) => left.sort - right.sort || left.id.localeCompare(right.id)));
}

function productTimeline(product: ProductDetail): ProductDetailBase['timeline'] {
  const values: ProductDetailBase['timeline'][number][] = [
    Object.freeze({ id: `timeline:productcreated:${product.id}`, kind: 'productcreated', title: '商品主档已创建', occurredAt: product.createdAt, reference: product.id }),
    Object.freeze({ id: `timeline:productupdated:${product.id}`, kind: 'productupdated', title: '商品主档已更新', occurredAt: product.updatedAt, reference: product.id }),
    ...product.listings.flatMap((listing) => [
      Object.freeze({ id: `timeline:listingcreated:${listing.id}`, kind: 'listingcreated' as const, title: '商城投放已创建', occurredAt: listing.createdAt, reference: listing.id }),
      Object.freeze({ id: `timeline:listingupdated:${listing.id}`, kind: 'listingupdated' as const, title: '商城投放已更新', occurredAt: listing.updatedAt, reference: listing.id }),
    ]),
    ...product.channels.map((channel) => Object.freeze({ id: `timeline:sourceobserved:${channel.provider}:${channel.externalId}`, kind: 'sourceobserved' as const, title: '渠道来源已同步', occurredAt: channel.observedAt, reference: channel.externalId })),
  ];
  return Object.freeze(values.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id)));
}

function textArray(value: unknown): readonly string[] {
  return Object.freeze(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '') : []);
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function safeMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function restore(row: Readonly<Record<string, unknown>>): ProductSnapshot {
  return Object.freeze({
    id: String(row.id), scope: String(row.scope_id), owner: typeof row.owner_partner_id === 'string' ? row.owner_partner_id : null,
    brand: typeof row.brand_id === 'string' ? row.brand_id : null, category: String(row.category_id), title: String(row.title),
    kind: row.product_type as ProductSnapshot['kind'], attributes: row.attributes as Readonly<Record<string, unknown>>,
    state: row.status as ProductSnapshot['state'], version: Number(row.version),
  });
}
