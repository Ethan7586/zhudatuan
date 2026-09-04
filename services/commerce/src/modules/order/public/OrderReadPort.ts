import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
export interface OrderSummary {
  readonly total: number;
  readonly awaitingPayment: number;
  readonly fulfilling: number;
  readonly aftersale: number;
  readonly version: number;
}
export interface OrderReadPort {
  summary(context: ReadTransactionContext, member: string, mall: string): Promise<OrderSummary>;
  resolveScope(order: string, signal: AbortSignal, deadline: number): Promise<string | null>;
}
export const ORDER_READ_PORT = publicPort<OrderReadPort>('order', 'read');
