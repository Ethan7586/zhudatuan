import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface PaymentRepository {
  read(context: ReadTransactionContext, membership: string, payment: string): Promise<Readonly<Record<string, unknown>>>;
}
