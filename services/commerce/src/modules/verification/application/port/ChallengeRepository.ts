import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface ChallengeSessionView {
  readonly id: string;
  readonly subject_type: 'member' | 'voucher' | 'principal' | 'resource';
  readonly subject_id: string;
  readonly purpose: 'member_code' | 'voucher_redeem' | 'login' | 'sensitive_action' | 'financial_approval';
  readonly operation_id: string;
  readonly channel: 'qrcode' | 'sms' | 'app';
  readonly state: 'issued' | 'verified' | 'expired' | 'revoked' | 'locked';
  readonly attempts: number;
  readonly maximum_attempts: number;
  readonly issued_at: Date;
  readonly expires_at: Date;
  readonly verified_at: Date | null;
  readonly version: number;
}

export interface ChallengeRepository {
  issue(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; membership: string; purpose: 'member_code' | 'voucher_redeem'; voucher: string | null; tokenHash: string; now: Date }>
  ): Promise<ChallengeSessionView>;
  revoke(
    context: WriteTransactionContext,
    input: Readonly<{ challenge: string; scope: string; membership: string; expectedVersion: number; now: Date }>
  ): Promise<ChallengeSessionView>;
  verify(
    context: WriteTransactionContext,
    input: Readonly<{ challenge: string; scope: string; actor: string; trace: string; tokenHash: string; proofId: string; proofHash: string; deviceHash: string; now: Date }>
  ): Promise<Readonly<{ accepted: true; value: Readonly<Record<string, unknown>> } | { accepted: false; status: 403 | 409 | 429; code: 'VERIFICATION_DEVICE_DENIED' | 'VERIFICATION_TOKEN_INVALID' | 'RATE_LIMITED' }>>;
}
