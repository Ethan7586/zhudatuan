import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CatalogSku } from '../../../catalog/public';
import type { InventoryImportRepository } from '../../application/port/InventoryImportRepository';
import { importStock } from './StockImportRow';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { randomUUID } from 'node:crypto';

export class PgInventoryImportRepository implements InventoryImportRepository {
  constructor(
    private readonly catalog: CatalogSku,
    private readonly transactions = new PgTransactionAccess()
  ) {}

  async import(context: WriteTransactionContext, scope: string, importid: string, row: number, value: Readonly<Record<string, string>>): Promise<void> {
    const database = this.transactions.database(context);
    const result = await importStock(database, this.catalog, scope, importid, row, value);
    if (result) await new PgRuntimeWriter(database).append({ id: `event:${randomUUID()}`, type: 'inventory.stock.changed',
      aggregateType: 'stockitem', aggregate: result.stockitem, scope, trace: context.trace, payload: { ...result } });
  }
}
