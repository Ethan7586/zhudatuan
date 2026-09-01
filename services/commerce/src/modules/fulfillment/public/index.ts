import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
export type { PaidFulfillment } from './PaidFulfillment';

export interface PaymentFulfillmentPort {
  create(context: WriteTransactionContext, input: import('./PaidFulfillment').PaidFulfillment): Promise<readonly string[]>;
}
export interface FinanceFulfillmentPort {
  reconciliation(context: ReadTransactionContext, references: readonly string[]): Promise<readonly FinanceFulfillmentMatch[]>;
}
export interface FinanceFulfillmentMatch {
  readonly reference: string;
  readonly kind: 'fulfillment';
  readonly id: string;
  readonly amountMinor: number;
}
export const PAYMENT_FULFILLMENT_PORT = publicPort<PaymentFulfillmentPort>('fulfillment', 'payment');
export const FINANCE_FULFILLMENT_PORT = publicPort<FinanceFulfillmentPort>('fulfillment', 'finance');
export { INVENTORY_RETURN_PORT, type InventoryReturnLine, type InventoryReturnPort, type InventoryReturnSnapshot } from './InventoryReturnPort';
