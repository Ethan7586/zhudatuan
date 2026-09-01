import type { QueryResultRow } from 'pg';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { boundedIdentifiers } from '../../../../foundation/persistence/BoundedIdentifiers';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { InventoryReadPort, StorefrontAvailability } from '../../public/InventoryReadPort';

interface AvailabilityRow extends QueryResultRow {
  readonly sku: string;
  readonly available: number;
  readonly version: string;
}

export class PgInventoryReadPort implements InventoryReadPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async availability(context: ReadTransactionContext, mall: string, skus: readonly string[]): Promise<readonly StorefrontAvailability[]> {
    const selected = boundedIdentifiers(skus, 50, 'STOREFRONT_INVENTORY_SKUS_INVALID');
    if (selected.length === 0) return Promise.resolve(Object.freeze([]));
    const database = this.transactions.database(context);
    const result = await database.query<AvailabilityRow>(
      `select stock.sku_id sku,greatest(0,sum(stock.onhand-stock.safety)-coalesce(sum(reserved.quantity),0))::float8 available,
        max(stock.version)::text version from inventory.stockitem stock left join lateral(
          select coalesce(sum(reservation.quantity),0) quantity from inventory.reservation reservation
          where reservation.stockitem_id=stock.id and reservation.state='reserved' and reservation.expires_at>clock_timestamp()
        ) reserved on true where stock.scope_id=$1 and stock.status='active' and stock.sku_id=any($2::text[])
        group by stock.sku_id order by stock.sku_id`,
      [mall, selected]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ sku: row.sku, available: Number(row.available), state: Number(row.available) > 0 ? ('available' as const) : ('unavailable' as const), version: row.version })));
  }
}
