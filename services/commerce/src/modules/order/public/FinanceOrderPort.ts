import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface FinanceOrderPort {
  verified(context: ReadTransactionContext, orders: readonly string[]): Promise<readonly string[]>;
}

export const FINANCE_ORDER_PORT = publicPort<FinanceOrderPort>('order', 'finance');
