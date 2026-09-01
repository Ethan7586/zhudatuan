import type { QueryPage } from '../../../../foundation/interface/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface WithdrawalPosition {
  readonly availableMinor: string | number;
  readonly hasPendingReversal: boolean;
  readonly minimumMinor: string | number;
  readonly currency: string;
  readonly version: string | number;
}

export interface WithdrawalRepository {
  read(context: ReadTransactionContext, scope: string, member: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  position(context: ReadTransactionContext, scope: string, member: string): Promise<WithdrawalPosition | null>;
  create(context: WriteTransactionContext, input: Readonly<{ id: string; scopeId: string; memberId: string; amountMinor: number; currency: string; accountRef: string; expectedVersion: number }>): Promise<Readonly<Record<string, unknown>>>;
}
