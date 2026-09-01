import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ProviderHealthRepository {
  enabled(context: ReadTransactionContext, provider: string | null): Promise<readonly string[]>;
  record(context: WriteTransactionContext, provider: string, status: 'healthy' | 'degraded' | 'unavailable', latency: number, error: string | null): Promise<void>;
}
