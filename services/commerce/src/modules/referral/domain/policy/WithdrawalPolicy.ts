import { ReferralMoney } from '../value/ReferralMoney';
import { DomainError } from '../../../../foundation/domain/DomainError';

export class WithdrawalPolicy {
  assertRequest(amount: ReferralMoney, available: ReferralMoney, minimumMinor: bigint, hasPendingReversal: boolean, monthlyUsed = 0, monthlyLimit: number | null = null): void {
    if (amount.currency !== available.currency || amount.amountMinor < minimumMinor) throw new DomainError('REFERRAL_WITHDRAWAL_TOO_SMALL');
    if (amount.amountMinor > available.amountMinor || hasPendingReversal) throw new DomainError('REFERRAL_WITHDRAWAL_CONFLICT');
    if (!Number.isSafeInteger(monthlyUsed) || monthlyUsed < 0 || (monthlyLimit !== null && (!Number.isSafeInteger(monthlyLimit) || monthlyLimit < 1 || monthlyUsed >= monthlyLimit)))
      throw new DomainError('REFERRAL_WITHDRAWAL_CONFLICT');
  }

  assertApproval(input: Readonly<{ requesterId: string; checkerId: string; subjectId: string; withdrawalId: string; action: string }>): void {
    if (!input.requesterId || !input.checkerId || input.requesterId === input.checkerId) throw new DomainError('REFERRAL_WITHDRAWAL_CONFLICT');
    if (input.subjectId !== input.withdrawalId || input.action !== 'referral.withdrawal.pay') throw new DomainError('REFERRAL_WITHDRAWAL_CONFLICT');
  }
}
