export interface FinancePoster {
  post(
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
