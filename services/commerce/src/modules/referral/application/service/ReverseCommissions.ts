import type { FinancePoster } from '../port/FinancePoster';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

/** Explicit reversal service kept separate so recovery and manual reversals share one accounting boundary. */
export class ReverseCommissions {
  constructor(private readonly finance: FinancePoster) {}

  reverse(context: WriteTransactionContext, input: Readonly<{ businessKey: string; scopeId: string; beneficiaryId: string; amountMinor: bigint; currency: string; occurredAt: string }>): Promise<Readonly<{ journalId: string }>> {
    return this.finance.post(context, { ...input, kind: 'reversal' });
  }
}
