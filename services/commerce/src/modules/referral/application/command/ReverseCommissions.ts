import type { FinancePoster } from '../port/FinancePoster';

/** Explicit reversal service kept separate so recovery and manual reversals share one accounting boundary. */
export class ReverseCommissions {
  constructor(private readonly finance: FinancePoster) {}

  reverse(input: Readonly<{ businessKey: string; scopeId: string; beneficiaryId: string; amountMinor: bigint; currency: string; occurredAt: string }>): Promise<Readonly<{ journalId: string }>> {
    return this.finance.post({ ...input, kind: 'reversal' });
  }
}
