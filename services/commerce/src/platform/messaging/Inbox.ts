import type { OutboxMessage } from './Outbox';
import type { WriteTransactionContext } from '../database/TransactionContext';

export interface Inbox {
  accept(context: WriteTransactionContext, provider: string, operation: string, event: OutboxMessage): Promise<boolean>;
  complete(context: WriteTransactionContext, provider: string, operation: string, event: string): Promise<void>;
}
