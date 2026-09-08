import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';

export interface PaymentRepository {
  read(context: ReadTransactionContext, membership: string, payment: string): Promise<Readonly<Record<string, unknown>>>;
}
