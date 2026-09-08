import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

export interface FinanceOrderPort {
  verified(context: ReadTransactionContext, orders: readonly string[]): Promise<readonly string[]>;
}

export const FINANCE_ORDER_PORT = publicPort<FinanceOrderPort>('order', 'finance');
