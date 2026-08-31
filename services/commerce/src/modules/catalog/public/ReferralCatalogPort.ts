import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import type { ReadDatabaseWorkload } from '../../../foundation/persistence/Workload';

export interface ReferralCatalogPort {
  product(scopeId: string, productId: string): Promise<Readonly<{ productId: string; active: boolean; version: number }> | null>;
}

export const REFERRAL_CATALOG_PORT = publicPort<ReferralCatalogPort>('catalog', 'referral');

export class PgReferralCatalogPort implements ReferralCatalogPort {
  private readonly pool: DatabasePool;
  constructor(pool: DatabasePool, workload: ReadDatabaseWorkload = 'query') {
    this.pool = pool.workload(workload);
  }

  async product(scopeId: string, productId: string): Promise<Readonly<{ productId: string; active: boolean; version: number }> | null> {
    const result = await this.pool.query<{ id: string; version: number; active: boolean }>(
      `select product.id,product.version,product.status='active' and exists(select 1 from catalog.listing listing
      join catalog.sku sku on sku.id=listing.sku_id where sku.product_id=product.id and listing.scope_id=$1 and listing.status='published') active
      from catalog.product product where product.id=$2`,
      [scopeId, productId]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ productId: row.id, active: row.active, version: row.version }) : null;
  }
}
