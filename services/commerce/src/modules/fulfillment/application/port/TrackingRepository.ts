import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface TrackingRepository {
  read(context: ReadTransactionContext, order: string, member: string): Promise<readonly Readonly<Record<string, unknown>>[]>;
}
