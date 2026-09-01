import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface FulfillmentRepository {
  ship(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; actor: string; tracking: string; carrier: unknown }>): Promise<Readonly<Record<string, unknown>>>;
}
