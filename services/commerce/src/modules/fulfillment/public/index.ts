import { publicPort } from '../../../bootstrap/ModuleRegistry';
export type { PaidFulfillment } from '../FulfillmentPort';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
export interface PaymentFulfillmentPort {
  create(database: OperationDatabase, input: import('../FulfillmentPort').PaidFulfillment): Promise<readonly string[]>;
}
export interface FinanceFulfillmentPort {
  reconciliation(database: OperationDatabase, references: readonly string[]): Promise<readonly FinanceFulfillmentMatch[]>;
}
export interface FinanceFulfillmentMatch {
  readonly reference: string;
  readonly kind: 'fulfillment';
  readonly id: string;
  readonly amountMinor: number;
}
export const PAYMENT_FULFILLMENT_PORT = publicPort<PaymentFulfillmentPort>('fulfillment', 'payment');
export const FINANCE_FULFILLMENT_PORT = publicPort<FinanceFulfillmentPort>('fulfillment', 'finance');
export { INVENTORY_RETURN_PORT, PgInventoryReturnPort, type InventoryReturnLine, type InventoryReturnPort, type InventoryReturnSnapshot } from './InventoryReturnPort';
