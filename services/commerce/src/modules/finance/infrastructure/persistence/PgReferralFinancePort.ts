import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgAccountingPort } from './PgAccountingPort';
import type { ReferralFinancePort } from '../../public/ReferralFinancePort';
export class PgReferralFinancePort implements ReferralFinancePort {
  private readonly finance = new PgAccountingPort();
  async post(
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
  ): Promise<
    Readonly<{
      journalId: string;
    }>
  > {
    if (input.amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('REFERRAL_AMOUNT_OVERFLOW');
    const journalId = await this.finance.post(context, posting(input));
    return Object.freeze({ journalId });
  }
}
function posting(
  input: Readonly<{
    businessKey: string;
    scopeId: string;
    beneficiaryId: string;
    kind: 'commission' | 'reversal' | 'withdrawal';
    amountMinor: bigint;
    currency: string;
    occurredAt: string;
  }>
) {
  const payable = { code: `referralcommissionpayable:${input.beneficiaryId}`, kind: 'liability' as const };
  const expense = { code: 'referralcommissionexpense', kind: 'expense' as const };
  const cash = { code: 'referralwithdrawalcash', kind: 'asset' as const };
  return {
    scopeId: input.scopeId,
    source: { module: 'referral', aggregate: 'commission', aggregateId: input.businessKey, event: `referral.${input.kind}`, eventId: input.businessKey, leg: input.kind },
    currency: input.currency,
    description: `Referral ${input.kind}`,
    debit: input.kind === 'commission' ? expense : payable,
    credit: input.kind === 'withdrawal' ? cash : input.kind === 'reversal' ? expense : payable,
    amountMinor: Number(input.amountMinor),
    occurredAt: input.occurredAt,
  } as const;
}
