import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface ReleaseRepository {
  publish(context: WriteTransactionContext, input: Readonly<{ application: string; version: string; pool: string; actor: string; trace: string }>): Promise<Readonly<Record<string, unknown>>>;
}
