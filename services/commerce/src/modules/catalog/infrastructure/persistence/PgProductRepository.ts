import { randomUUID } from 'node:crypto';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CatalogInventoryPort } from '../../../inventory/public';
import type { CatalogPartnerPort } from '../../../partner/public';
import type { CatalogPricingPort } from '../../../pricing/public';
import type { ProductRepository } from '../../application/port/ProductRepository';
import type { CatalogScopeReader } from './CatalogScopeReader';
interface ProductDetail extends Readonly<Record<string, unknown>> {
  readonly owner_partner_id: string | null;
  readonly skus: readonly Readonly<{
    id: string;
  }>[];
  readonly listings: readonly unknown[];
}
export class PgProductRepository implements ProductRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly scopes: CatalogScopeReader,
    private readonly partners: CatalogPartnerPort,
    private readonly inventory: CatalogInventoryPort,
    private readonly pricing: CatalogPricingPort
  ) {}
  async detail(context: ReadTransactionContext, productId: string, scope: string, store: boolean) {
    const database = this.transactions.database(context);
    const allowedScopes = await this.scopes.visible(context, scope, store);
    const result = await database.query<ProductDetail>(
      `select product.id,product.title,product.product_type,product.status,product.version::text version,
        product.category_id,product.brand_id,product.owner_partner_id,
        product.attributes->>'coverUrl' cover_url,product.attributes->>'subtitle' subtitle,
        coalesce((select jsonb_agg(jsonb_build_object('id',sku.id,'code',sku.code,'status',sku.status,
          'specifications',coalesce((select jsonb_agg(jsonb_build_object('name',specification.key,'value',specification.value)
            order by specification.key) from jsonb_each_text(sku.specifications) specification),'[]'::jsonb),
          'version',sku.version::text) order by sku.code,sku.id) from catalog.sku sku
          where sku.product_id=product.id),'[]'::jsonb) skus,
        coalesce((select jsonb_agg(jsonb_build_object('id',listing.id,'scope',listing.scope_id,
          'pool',listing.pool_id,'sku',listing.sku_id,'title',listing.title,'status',listing.status,
          'effectiveAt',listing.effective_at,'expiresAt',listing.expires_at,'version',listing.version::text)
          order by listing.updated_at desc,listing.id) from catalog.listing listing
          where listing.sku_id in(select sku.id from catalog.sku sku where sku.product_id=product.id)
            and listing.scope_id=any($2::text[])),'[]'::jsonb) listings
      from catalog.product product where product.id=$1`,
      [productId, allowedScopes]
    );
    const product = result.rows[0];
    if (!product) throw new DomainError('LISTING_NOT_PURCHASABLE');
    const ownerScope = product.owner_partner_id ? await this.partners.scope(context, product.owner_partner_id) : null;
    if (product.listings.length === 0 && (ownerScope === null || !allowedScopes.includes(ownerScope))) throw new DomainError('LISTING_NOT_PURCHASABLE');
    const skus = product.skus.map(({ id }) => id);
    const [stock, prices] = await Promise.all([this.inventory.stock(context, skus, allowedScopes), this.pricing.prices(context, skus, allowedScopes)]);
    return Object.freeze({ ...product, inventory: stock, prices });
  }
  async create(context: WriteTransactionContext, input: Parameters<ProductRepository['create']>[1]) {
    const database = this.transactions.database(context);
    const suffix = randomUUID();
    const id = `product:${suffix}`;
    const sku = `sku:${suffix}`;
    const category = await this.category(database, input.category);
    const result = await database.query(
      `insert into catalog.product(id,scope_id,owner_partner_id,brand_id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'draft',0,clock_timestamp(),clock_timestamp()) returning *`,
      [id, input.scope, input.owner, input.brand, category, input.title, input.kind, JSON.stringify(input.attributes)]
    );
    await database.query(`insert into catalog.sku(id,product_id,code,specifications,status,version) values($1,$2,$3,'{}'::jsonb,'draft',0)`, [sku, id, `LOCAL-${suffix}`]);
    await database.query(
      `insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,expires_at,version,created_at,updated_at)
      values($1,$2,null,$3,$4,'draft',null,null,0,clock_timestamp(),clock_timestamp())`,
      [`listing:${suffix}`, input.scope, sku, input.title]
    );
    const product = result.rows[0];
    if (!product) throw new Error('CATALOG_PRODUCT_CREATE_FAILED');
    return Object.freeze({ ...product });
  }
  async update(context: WriteTransactionContext, input: Parameters<ProductRepository['update']>[1]) {
    const database = this.transactions.database(context);
    const visible = await this.scopes.visible(database.transaction, input.scope, false);
    const category = input.category === null ? null : await this.category(database, input.category);
    const result = await database.query(
      `update catalog.product set title=coalesce($2,title),category_id=coalesce($3,category_id),attributes=coalesce($4::jsonb,attributes),
      status=coalesce($5,status),version=version+1,updated_at=clock_timestamp() where id=$1 and ($6::bigint is null or version=$6)
      and scope_id=any($7::text[]) returning *`,
      [input.id, input.title, category, input.attributes === null ? null : JSON.stringify(input.attributes), input.status, input.expectedVersion, visible]
    );
    const product = result.rows[0];
    if (!product) throw new DomainError('VERSION_CONFLICT');
    if (input.title !== null) {
      await database.query(`update catalog.listing listing set title=$2,updated_at=clock_timestamp() where listing.sku_id in(select sku.id from catalog.sku sku where sku.product_id=$1)`, [input.id, input.title]);
    }
    if (input.status === 'archived') await this.unpublish(database, input.id);
    return Object.freeze({ ...product });
  }
  async archive(context: ReadTransactionContext, id: string, scope: string, expectedVersion: number | null) {
    const database = this.transactions.database(context);
    const visible = await this.scopes.visible(context, scope, false);
    const result = await database.query(
      `update catalog.product set status='archived',version=version+1,updated_at=clock_timestamp()
      where id=$1 and ($2::bigint is null or version=$2) and scope_id=any($3::text[]) returning *`,
      [id, expectedVersion, visible]
    );
    const product = result.rows[0];
    if (!product) throw new DomainError('VERSION_CONFLICT');
    await this.unpublish(database, id);
    return Object.freeze({ ...product });
  }
  private async category(database: ReturnType<PgTransactionAccess['database']>, value: string): Promise<string> {
    const category = value.trim();
    const result = await database.query<{
      id: string;
    }>('select id from catalog.category where id=$1 or name=$1 order by case when id=$1 then 0 else 1 end limit 1', [category]);
    if (!result.rows[0]) throw new DomainError('VALIDATION_FAILED', { field: 'category' });
    return result.rows[0].id;
  }
  private async unpublish(database: ReturnType<PgTransactionAccess['database']>, product: string): Promise<void> {
    await database.query(
      `update catalog.listing listing set status='unpublished',expires_at=clock_timestamp(),version=listing.version+1,updated_at=clock_timestamp()
      from catalog.sku sku where sku.id=listing.sku_id and sku.product_id=$1 and listing.status<>'unpublished'`,
      [product]
    );
  }
}
