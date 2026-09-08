import type { StorefrontSession } from '../../../entity/session';
import type { ReferralEarnings, ReferralLink, ReferralMember, ReferralWithdrawal, ReferralWithdrawalPage } from '../model/Referral';

export interface ReferralPort {
  bind(session: StorefrontSession, token: string): Promise<unknown>;
  apply(session: StorefrontSession, input: Readonly<{ displayName: string; mobile: string; reason: string }>, idempotencyKey: string): Promise<ReferralMember>;
  earnings(session: StorefrontSession, cursor?: string, signal?: AbortSignal): Promise<ReferralEarnings>;
  link(session: StorefrontSession, productId?: string, signal?: AbortSignal): Promise<ReferralLink>;
  withdrawals(session: StorefrontSession, cursor?: string, signal?: AbortSignal): Promise<ReferralWithdrawalPage>;
  withdraw(session: StorefrontSession, input: Readonly<{ amountMinor: number; currency: string; accountRef: string; expectedVersion: number }>, idempotencyKey: string): Promise<ReferralWithdrawal>;
}
