import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface ChallengeRepository {
  issue(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; membership: string; purpose: 'member_code' | 'voucher_redeem'; voucher: string | null; tokenHash: string; now: Date }>): Promise<Readonly<Record<string, unknown>>>;
  verify(
    context: WriteTransactionContext,
    input: Readonly<{ challenge: string; scope: string; actor: string; trace: string; tokenHash: string; proofId: string; proofHash: string; deviceHash: string; now: Date }>
  ): Promise<Readonly<{ accepted: true; value: Readonly<Record<string, unknown>> } | { accepted: false; status: 403 | 409 | 429; code: 'VERIFICATION_DEVICE_DENIED' | 'VERIFICATION_TOKEN_INVALID' | 'RATE_LIMITED' }>>;
}
