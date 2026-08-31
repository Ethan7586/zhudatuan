import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { FulfillmentOrderPort } from '../../order/public';

export interface InventoryReturnLine {
  readonly line: string;
  readonly sku: string;
  readonly quantity: number;
}

export interface InventoryReturnSnapshot {
  readonly reference: string;
  readonly scope: string;
  readonly location: string | null;
  readonly lines: readonly InventoryReturnLine[];
}

export interface InventoryReturnPort {
  restock(database: OperationDatabase, reference: string): Promise<InventoryReturnSnapshot | null>;
}

export const INVENTORY_RETURN_PORT = publicPort<InventoryReturnPort>('fulfillment', 'inventory');

export class PgInventoryReturnPort implements InventoryReturnPort {
  constructor(private readonly orders: FulfillmentOrderPort) {}

  async restock(database: OperationDatabase, reference: string): Promise<InventoryReturnSnapshot | null> {
    const result = await database.query<{
      order: string;
      location: string | null;
      line: string;
      quantity: number;
    }>(
      `select fulfillment.order_id "order",fulfillment.store_id location,line.order_line_id line,line.quantity::float8 quantity
      from fulfillment.returnrecord returned join fulfillment.fulfillmentorder fulfillment on fulfillment.id=returned.fulfillment_id
      join fulfillment.line line on line.fulfillment_id=fulfillment.id
      where returned.id=$1 and returned.state='accepted' order by line.order_line_id for update of returned`,
      [reference]
    );
    const row = result.rows[0];
    if (!row) return null;
    const quantities = new Map(result.rows.map(({ line, quantity }) => [line, quantity]));
    if (quantities.size !== result.rows.length || [...quantities.values()].some((quantity) => !Number.isSafeInteger(quantity) || quantity <= 0)) throw new Error('RETURN_LINE_INVALID');
    const order = await this.orders.snapshot(database, row.order);
    if (!order) throw new Error('RETURN_ORDER_NOT_FOUND');
    const skus = await this.orders.lineSkus(database, row.order, [...quantities.keys()]);
    if (skus.length !== quantities.size) throw new Error('RETURN_ORDER_LINE_MISMATCH');
    return Object.freeze({
      reference,
      scope: order.scope,
      location: row.location,
      lines: Object.freeze(skus.map(({ line, sku }) => Object.freeze({ line, sku, quantity: quantities.get(line)! }))),
    });
  }
}
