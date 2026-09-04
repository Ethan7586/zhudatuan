import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrderFulfillmentPort } from '../../../order/public';
import type { InventoryReturnSnapshot, InventoryReturnPort } from '../../public/InventoryReturnPort';
export class PgInventoryReturnPort implements InventoryReturnPort {
  private readonly transactions = new PgTransactionAccess();
  constructor(private readonly orders: OrderFulfillmentPort) {}
  async restock(context: WriteTransactionContext, reference: string): Promise<InventoryReturnSnapshot | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      order: string;
      location: string | null;
      line: string;
      quantity: number;
    }>(
      `select fulfillment.order_id "order",fulfillment.store_id location,line.order_line_id line,line.quantity::float8 quantity
      from fulfillment.returnrecord returned join fulfillment.fulfillmentorder fulfillment on fulfillment.id=returned.fulfillment_id
      join fulfillment.returnline line on line.return_id=returned.id
      where returned.id=$1 and returned.state='accepted' order by line.order_line_id for update of returned`,
      [reference]
    );
    const row = result.rows[0];
    if (!row) return null;
    const quantities = new Map(result.rows.map(({ line, quantity }) => [line, quantity]));
    if (quantities.size !== result.rows.length || [...quantities.values()].some((quantity) => !Number.isSafeInteger(quantity) || quantity <= 0)) throw new Error('RETURN_LINE_INVALID');
    const order = await this.orders.snapshot(context, row.order);
    if (!order) throw new Error('RETURN_ORDER_NOT_FOUND');
    const skus = await this.orders.lineSkus(context, row.order, [...quantities.keys()]);
    if (skus.length !== quantities.size) throw new Error('RETURN_ORDER_LINE_MISMATCH');
    return Object.freeze({
      reference,
      scope: order.scope,
      location: row.location,
      lines: Object.freeze(skus.map(({ line, sku }) => Object.freeze({ line, sku, quantity: quantities.get(line)! }))),
    });
  }
}
