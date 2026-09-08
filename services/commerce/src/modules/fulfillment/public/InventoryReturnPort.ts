import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

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
  restock(context: WriteTransactionContext, reference: string): Promise<InventoryReturnSnapshot | null>;
}
export const INVENTORY_RETURN_PORT = publicPort<InventoryReturnPort>('fulfillment', 'inventory');
