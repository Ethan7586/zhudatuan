import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface ExperienceCatalogReferences {
  readonly products: readonly string[];
  readonly categories: readonly string[];
  readonly collections: readonly string[];
}
export interface ExperienceCatalogPort {
  activeBinding(database: OperationDatabase, malls: readonly string[]): Promise<Readonly<{ mall: string; pool: string }> | null>;
  references(database: OperationDatabase, pool: string, input: ExperienceCatalogReferences): Promise<boolean>;
}
export const EXPERIENCE_CATALOG_PORT = publicPort<ExperienceCatalogPort>('catalog', 'experience');

export class PgExperienceCatalogPort implements ExperienceCatalogPort {
  async activeBinding(database: OperationDatabase, malls: readonly string[]): Promise<Readonly<{ mall: string; pool: string }> | null> {
    if (malls.length === 0) return null;
    const result = await database.query<{ mall_id: string; pool_id: string }>(
      `select binding.mall_id,binding.pool_id from catalog.poolbinding binding
      join catalog.pool pool on pool.id=binding.pool_id and pool.status='active'
      where binding.mall_id=any($1::text[]) and binding.status='active'
      and (binding.effective_at is null or binding.effective_at<=clock_timestamp())
      and (binding.expires_at is null or binding.expires_at>clock_timestamp())
      order by binding.mall_id,binding.pool_id limit 1`,
      [malls]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ mall: row.mall_id, pool: row.pool_id }) : null;
  }

  async references(database: OperationDatabase, pool: string, input: ExperienceCatalogReferences): Promise<boolean> {
    const result = await database.query<{ products: number; categories: number; collections: number }>(
      `select
      (select count(distinct product.id)::integer from catalog.product product join catalog.sku sku on sku.product_id=product.id
        join catalog.listing listing on listing.sku_id=sku.id and listing.pool_id=$1
        where product.id=any($2::text[]) and product.status='active' and listing.status='published') products,
      (select count(*)::integer from catalog.category where id=any($3::text[]) and status='active') categories,
      (select count(*)::integer from catalog.pool where id=any($4::text[]) and status='active') collections`,
      [pool, input.products, input.categories, input.collections]
    );
    const row = result.rows[0];
    return row?.products === input.products.length && row.categories === input.categories.length && row.collections === input.collections.length;
  }
}
