import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export type RecoveryAction = 'replay' | 'requery' | 'retryrefund' | 'resolve';

export interface RecoveryPage {
  readonly sort: string | null;
  readonly id: string | null;
  readonly fetch: number;
  readonly limit: number;
}

export interface RecoveryRepository {
  read(context: ReadTransactionContext, input: Readonly<{ scope: string; order: string | null; page: RecoveryPage }>): Promise<Readonly<Record<string, unknown>>>;
  resolve(
    context: WriteTransactionContext,
    input: Readonly<{ case: string; action: RecoveryAction; reason: string; scope: string; actor: string; membership: string; trace: string; idempotency: string; expectedVersion: number }>
  ): Promise<Readonly<{ case: string; request: string; action: RecoveryAction; state: 'resolved' | 'accepted' }>>;
}
