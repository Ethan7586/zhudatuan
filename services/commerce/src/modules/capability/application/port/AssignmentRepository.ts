import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface Assignment {
  readonly id: string;
  readonly scopeId: string;
  readonly capabilityId: string;
  readonly name?: string;
  readonly state: 'enabled' | 'disabled';
  readonly quota: number | null;
  readonly effectiveAt: string;
  readonly expiresAt: string | null;
  readonly version: number;
}
export interface AssignmentRepository {
  list(context: ReadTransactionContext, input: Readonly<{ scope: string; sort: string | null; id: string | null; fetch: number }>): Promise<readonly Assignment[]>;
  save(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; capability: string; state: 'enabled' | 'disabled'; quota: number | null; expiresAt: string | null; expectedVersion: number | null }>
  ): Promise<Assignment | null>;
}
