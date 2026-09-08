import { publicPort } from '../../../composition/ModuleRegistry';
import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';
export interface ReferralFinancePort {
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
  ): Promise<
    Readonly<{
      journalId: string;
    }>
  >;
}
export const REFERRAL_FINANCE_PORT = publicPort<ReferralFinancePort>('finance', 'referral');
