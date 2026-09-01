import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ListingFilter, ListingRepository } from '../../application/port/ListingRepository';
import type { CatalogScopeReader } from './CatalogScopeReader';
export class PgListingRepository implements ListingRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly scopes: CatalogScopeReader
  ) {}
  async read(context: ReadTransactionContext, filter: ListingFilter) {
    const database = this.transactions.database(context);
    if (filter.scopeKind === 'supplier') {
      const result = await database.query(
        `select source.id,source.sku_id,coalesce(product.title,source.external_id) title,
        source.status,source.source_version version,source.observed_at cursor_sort,sku.code,product.id product_id,product.product_type,
        product.attributes->>'coverUrl' cover_url,product.attributes->>'subtitle' subtitle from catalog.sourcelisting source
        left join catalog.sku sku on sku.id=source.sku_id left join catalog.product product on product.id=sku.product_id where source.scope_id=$1
        and ($2='' or product.title ilike '%'||$2||'%' or sku.code ilike '%'||$2||'%' or source.external_id ilike '%'||$2||'%')
        and ($3='' or product.category_id=$3) and ($4='' or product.id=$4)
        and ($5::timestamptz is null or (source.observed_at,source.id)<($5::timestamptz,$6)) order by source.observed_at desc,source.id desc limit $7`,
        [filter.scope, filter.query, filter.category, filter.product, filter.page.sort, filter.page.id, filter.page.fetch]
      );
      return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
    }
    const scopes = await this.scopes.visible(context, filter.scope, filter.scopeKind === 'store');
    const result = await database.query(
      `select listing.id,listing.pool_id,listing.sku_id,listing.title,listing.status,listing.effective_at,listing.expires_at,listing.version,listing.updated_at cursor_sort,
      sku.code,product.id product_id,product.product_type,product.attributes->>'coverUrl' cover_url,
      product.attributes->>'subtitle' subtitle from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id
      join catalog.product product on product.id=sku.product_id where listing.scope_id=any($1::text[])
      and ($2='' or listing.title ilike '%'||$2||'%' or sku.code ilike '%'||$2||'%') and ($3='' or product.category_id=$3) and ($4='' or product.id=$4)
      and ($5='' or listing.pool_id=$5) and (not $6 or (listing.status='published' and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
        and (listing.expires_at is null or listing.expires_at>clock_timestamp())))
      and ($7::timestamptz is null or (listing.updated_at,listing.id)<($7::timestamptz,$8))
      order by listing.updated_at desc,listing.id desc limit $9`,
      [scopes, filter.query, filter.category, filter.product, filter.pool, filter.actorTarget === 'storefront', filter.page.sort, filter.page.id, filter.page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
  async publish(context: ReadTransactionContext, id: string, scope: string, expectedVersion: number | null) {
    const database = this.transactions.database(context);
    const scopes = await this.scopes.visible(context, scope, false);
    const result = await database.query(
      `update catalog.listing listing set status='published',effective_at=clock_timestamp(),expires_at=null,
      version=listing.version+1,updated_at=clock_timestamp() where listing.id=$1 and listing.scope_id=any($3::text[])
      and ($2::bigint is null or listing.version=$2) and exists(select 1 from catalog.sku sku
        join catalog.product product on product.id=sku.product_id where sku.id=listing.sku_id and product.status='active') returning listing.*`,
      [id, expectedVersion, scopes]
    );
    const published = result.rows[0];
    if (published) return Object.freeze({ ...published });
    const reason = await database.query<{ status: string; version: string }>(
      `select product.status,listing.version::text version from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id
      join catalog.product product on product.id=sku.product_id where listing.id=$1 and listing.scope_id=any($2::text[])`,
      [id, scopes]
    );
    const current = reason.rows[0];
    if (current && (expectedVersion === null || Number(current.version) === expectedVersion) && current.status !== 'active') {
      throw new DomainError('LISTING_NOT_PURCHASABLE', { reason: 'PRODUCT_NOT_ACTIVE' });
    }
    throw new DomainError('VERSION_CONFLICT');
  }
  async unpublish(context: ReadTransactionContext, id: string, scope: string, expectedVersion: number | null) {
    const database = this.transactions.database(context);
    const scopes = await this.scopes.visible(context, scope, false);
    const result = await database.query(
      `update catalog.listing set status='unpublished',expires_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp()
      where id=$1 and scope_id=any($3::text[]) and ($2::bigint is null or version=$2) returning *`,
      [id, expectedVersion, scopes]
    );
    return this.required(result.rows[0]);
  }
  async batch(context: ReadTransactionContext, scope: string, ids: readonly string[], state: 'published' | 'unpublished') {
    const database = this.transactions.database(context);
    const scopes = await this.scopes.visible(context, scope, false);
    const result = await database.query(
      `update catalog.listing set status=$3,effective_at=case when $3='published' then clock_timestamp() else effective_at end,
      expires_at=case when $3='unpublished' then clock_timestamp() else null end,version=version+1,updated_at=clock_timestamp()
      where scope_id=any($1::text[]) and id=any($2::text[]) and ($3<>'published' or exists(
        select 1 from catalog.sku sku join catalog.product product on product.id=sku.product_id
        where sku.id=catalog.listing.sku_id and product.status='active')) returning id,status,version`,
      [scopes, ids, state]
    );
    return Object.freeze({ rows: Object.freeze(result.rows.map((row) => Object.freeze({ ...row }))), count: result.rowCount ?? 0 });
  }
  private required(row: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> {
    if (!row) throw new DomainError('VERSION_CONFLICT');
    return Object.freeze({ ...row });
  }
}
