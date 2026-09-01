import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ReturnRepository {
  receive(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; actor: string; tracking: unknown; expectedVersion: number | null }>): Promise<Readonly<Record<string, unknown>>>;
  inspect(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; actor: string; trace: string; accepted: boolean; evidence: unknown; expectedVersion: number | null }>): Promise<Readonly<Record<string, unknown>>>;
}
