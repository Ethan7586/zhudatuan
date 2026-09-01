import type { WriteTransactionContext } from '../persistence/TransactionContext';

export interface SessionSecurity {
  invalidate(context: WriteTransactionContext, principal: string, reason: 'risk_event'): Promise<void>;
}
