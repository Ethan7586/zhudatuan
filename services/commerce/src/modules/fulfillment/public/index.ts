import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
export interface FinanceFulfillmentPort {
  reconciliation(context: ReadTransactionContext, references: readonly string[]): Promise<readonly FinanceFulfillmentMatch[]>;
}
export interface FinanceFulfillmentMatch {
  readonly reference: string;
  readonly kind: 'fulfillment';
  readonly id: string;
  readonly amountMinor: number;
}
export const FINANCE_FULFILLMENT_PORT = publicPort<FinanceFulfillmentPort>('fulfillment', 'finance');
export { INVENTORY_RETURN_PORT, type InventoryReturnLine, type InventoryReturnPort, type InventoryReturnSnapshot } from './InventoryReturnPort';
