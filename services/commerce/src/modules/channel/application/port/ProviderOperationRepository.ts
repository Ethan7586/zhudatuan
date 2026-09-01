import type { QueryPage } from '../../../../foundation/interface/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ProviderOperationInput {
  readonly id: string;
  readonly provider: string;
  readonly scope: string;
  readonly kind: 'order' | 'return' | 'refund';
  readonly idempotency: string;
  readonly reference: string;
  readonly external: string | null;
  readonly state: 'queued' | 'processing' | 'succeeded' | 'failed' | 'unknown';
  readonly requestHash: string;
  readonly response: unknown;
}

export interface ProviderOperationRepository {
  read(context: ReadTransactionContext, scope: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  replay(context: WriteTransactionContext, operation: string, scope: string): Promise<Readonly<Record<string, unknown>>>;
  record(context: WriteTransactionContext, input: ProviderOperationInput): Promise<void>;
  replayReference(context: ReadTransactionContext, operation: string, kind: 'order' | 'return' | 'refund'): Promise<string>;
  update(
    context: WriteTransactionContext,
    input: Readonly<{ provider: string; kind: 'order' | 'return' | 'refund'; idempotency: string; external?: string; state: 'queued' | 'processing' | 'succeeded' | 'failed' | 'unknown'; response: unknown }>
  ): Promise<void>;
}
