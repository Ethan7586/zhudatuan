import { publicPort } from '../../../bootstrap/ModuleRegistry';
import { PgUnitOfWork } from '../../../adapter/database/PgUnitOfWork';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import type { WriteDatabaseWorkload } from '../../../foundation/persistence/Workload';
import { FinancePort } from '../FinancePort';

export interface ReferralFinancePort {
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

export const REFERRAL_FINANCE_PORT = publicPort<ReferralFinancePort>('finance', 'referral');

export class PgReferralFinancePort implements ReferralFinancePort {
  private readonly unit: PgUnitOfWork;
  private readonly finance = new FinancePort();
  constructor(
    pool: DatabasePool,
    private readonly workload: WriteDatabaseWorkload = 'command'
  ) {
    this.unit = new PgUnitOfWork(pool.workload(workload));
  }

  async post(
    input: Readonly<{
      businessKey: string;
      scopeId: string;
      beneficiaryId: string;
      kind: 'commission' | 'reversal' | 'withdrawal';
      amountMinor: bigint;
      currency: string;
      occurredAt: string;
    }>
  ): Promise<Readonly<{ journalId: string }>> {
    if (input.amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('REFERRAL_AMOUNT_OVERFLOW');
    const journalId = await this.unit.execute<string>(
      { tenant: input.scopeId, membership: '', scope: input.scopeId, actor: 'system:referral', trace: input.businessKey, operation: 'referral.commission.settle', workload: this.workload },
      (transaction) => this.finance.post(transaction, posting(input))
    );
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
    scope: input.scopeId,
    referenceType: `referral${input.kind}`,
    referenceId: input.businessKey,
    currency: input.currency,
    description: `Referral ${input.kind}`,
    debit: input.kind === 'commission' ? expense : payable,
    credit: input.kind === 'withdrawal' ? cash : input.kind === 'reversal' ? expense : payable,
    amountMinor: Number(input.amountMinor),
    occurredAt: input.occurredAt,
    ownerEventId: input.businessKey,
    economicLegId: input.kind,
  } as const;
}
