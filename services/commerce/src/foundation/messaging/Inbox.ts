import type { OutboxMessage } from './Outbox';
import type { Transaction } from '../persistence/UnitOfWork';

export interface Inbox {
  accept(transaction: Transaction, provider: string, operation: string, event: OutboxMessage): Promise<boolean>;
  complete(transaction: Transaction, provider: string, operation: string, event: string): Promise<void>;
}
