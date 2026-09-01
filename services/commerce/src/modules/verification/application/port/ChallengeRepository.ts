import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ChallengeRepository {
  issue(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; membership: string; purpose: 'member_code' | 'voucher_redeem'; voucher: string | null; nonceHash: string }>): Promise<Readonly<Record<string, unknown>>>;
  verify(context: WriteTransactionContext, input: Readonly<{ challenge: string; scope: string; actor: string; trace: string; nonceHash: string; deviceHash: string }>): Promise<Readonly<Record<string, unknown>>>;
}
