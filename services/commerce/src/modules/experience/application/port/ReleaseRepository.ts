import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ReleaseRepository {
  publish(context: WriteTransactionContext, input: Readonly<{ application: string; version: string; pool: string; actor: string; trace: string }>): Promise<Readonly<Record<string, unknown>>>;
}
