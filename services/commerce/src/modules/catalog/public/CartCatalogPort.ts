import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface CartListingSnapshot {
  readonly listing: string;
  readonly sku: string;
  readonly title: string;
  readonly version: number;
}

export interface CartCatalogPort {
  purchasable(database: OperationDatabase, listing: string, scope: string): Promise<CartListingSnapshot | null>;
  purchasableMany(database: OperationDatabase, listings: readonly string[], scope: string): Promise<ReadonlyMap<string, CartListingSnapshot>>;
}

export const CART_CATALOG_PORT = publicPort<CartCatalogPort>('catalog', 'cart');

export class PgCartCatalogPort implements CartCatalogPort {
  async purchasable(database: OperationDatabase, listing: string, scope: string): Promise<CartListingSnapshot | null> {
    const result = await database.query<{ id: string; sku_id: string; title: string; version: number }>(
      `select id,sku_id,title,version::integer from catalog.listing where id=$1 and scope_id=$2 and status='published'
      and (effective_at is null or effective_at<=clock_timestamp())
      and (expires_at is null or expires_at>clock_timestamp())`,
      [listing, scope]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ listing: row.id, sku: row.sku_id, title: row.title, version: row.version }) : null;
  }

  async purchasableMany(database: OperationDatabase, listings: readonly string[], scope: string): Promise<ReadonlyMap<string, CartListingSnapshot>> {
    if (listings.length === 0) return new Map();
    const result = await database.query<{ id: string; sku_id: string; title: string; version: number }>(
      `select id,sku_id,title,version::integer from catalog.listing where id=any($1::text[]) and scope_id=$2 and status='published'
      and (effective_at is null or effective_at<=clock_timestamp())
      and (expires_at is null or expires_at>clock_timestamp()) order by id`,
      [listings, scope]
    );
    return new Map(result.rows.map((row) => [row.id, Object.freeze({ listing: row.id, sku: row.sku_id, title: row.title, version: row.version })]));
  }
}
