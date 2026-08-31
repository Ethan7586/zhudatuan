import type { QueryResultRow } from 'pg';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { ReadSession, type ReadScope } from '../../../foundation/persistence/ReadSession';
import { boundedIdentifiers } from '../../../foundation/persistence/BoundedIdentifiers';
import type { ReadDatabaseWorkload } from '../../../foundation/persistence/Workload';

export interface StorefrontPrice {
  readonly sku: string;
  readonly amountMinor: number;
  readonly compareMinor: number | null;
  readonly currency: string;
  readonly version: string;
}

export interface PricingReadPort {
  prices(scope: ReadScope, mall: string, skus: readonly string[]): Promise<readonly StorefrontPrice[]>;
}

interface PriceRow extends QueryResultRow {
  readonly sku: string;
  readonly amount_minor: number;
  readonly compare_minor: number | null;
  readonly currency: string;
  readonly version: string;
}

export class PgPricingReadPort implements PricingReadPort {
  private readonly reads: ReadSession;
  constructor(pool: DatabasePool, workload: ReadDatabaseWorkload = 'query') {
    this.reads = new ReadSession(pool, workload);
  }
  prices(scope: ReadScope, mall: string, skus: readonly string[]): Promise<readonly StorefrontPrice[]> {
    const selected = boundedIdentifiers(skus, 50, 'STOREFRONT_PRICE_SKUS_INVALID');
    if (selected.length === 0) return Promise.resolve(Object.freeze([]));
    return this.reads.run(scope, async (database) => {
      const result = await database.query<PriceRow>(
        `select distinct on(price.sku_id) price.sku_id sku,price.amount_minor::float8 amount_minor,
        price.compare_minor::float8 compare_minor,book.currency,price.id version from pricing.pricebook book
        join pricing.price price on price.book_id=book.id where book.scope_id=$1 and book.status='active'
        and price.sku_id=any($2::text[]) and price.effective_at<=clock_timestamp()
        and (price.expires_at is null or price.expires_at>clock_timestamp())
        order by price.sku_id,price.effective_at desc,price.id`,
        [mall, selected]
      );
      return Object.freeze(
        result.rows.map((row) => Object.freeze({ sku: row.sku, amountMinor: Number(row.amount_minor), compareMinor: row.compare_minor === null ? null : Number(row.compare_minor), currency: row.currency, version: row.version }))
      );
    });
  }
}

export const PRICING_READ_PORT = publicPort<PricingReadPort>('pricing', 'read');
