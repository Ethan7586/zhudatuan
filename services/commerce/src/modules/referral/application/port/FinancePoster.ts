import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface FinancePoster {
  post(
    context: WriteTransactionContext,
    input: Readonly<{
      businessKey: string;
      scopeId: string;
      beneficiaryId: string;
      kind: 'commission' | 'reversal' | 'withdrawal';
      amountMinor: bigint;
      currency: string;
      occurredAt: string;
    }>
  ): Promise<Readonly<{ journalId: string }>>;
}
