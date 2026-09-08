import type { QueryPage } from '../../../../pipeline/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface WithdrawalPosition {
  readonly availableMinor: string | number;
  readonly hasPendingReversal: boolean;
  readonly minimumMinor: string | number;
  readonly monthlyUsed: string | number;
  readonly monthlyLimit: string | number | null;
  readonly currency: string;
  readonly version: string | number;
}

export interface WithdrawalRepository {
  read(context: ReadTransactionContext, scope: string, member: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  position(context: ReadTransactionContext, scope: string, member: string): Promise<WithdrawalPosition | null>;
  create(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scopeId: string; memberId: string; amountMinor: number; currency: string; accountRef: string; approvalId: string; expectedVersion: number }>
  ): Promise<Readonly<Record<string, unknown>>>;
}
