import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { OrderQuoteStore, StoredQuote } from '../order/OrderContractModule';

export class PurchaseOrderQuoteStore implements OrderQuoteStore {
  constructor(private readonly session: string) {}

  async load(database: OperationDatabase, quote: string, membership: string): Promise<StoredQuote> {
    const result = await database.query<StoredQuote>(
      'select * from access.purchase_order_quote($1,$2,$3)',
      [membership, this.session, quote],
    );
    const stored = result.rows[0];
    if (!stored) throw new Error('QUOTE_EXPIRED_OR_CONFLICT');
    return stored;
  }
}
