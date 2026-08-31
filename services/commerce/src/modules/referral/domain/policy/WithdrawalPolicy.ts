import { ReferralMoney } from '../value/ReferralMoney';
import { DomainError } from '../../../../foundation/domain/DomainError';

export class WithdrawalPolicy {
  assertRequest(amount: ReferralMoney, available: ReferralMoney, minimumMinor: bigint, hasPendingReversal: boolean): void {
    if (amount.currency !== available.currency || amount.amountMinor < minimumMinor) throw new DomainError('REFERRAL_WITHDRAWAL_TOO_SMALL');
    if (amount.amountMinor > available.amountMinor || hasPendingReversal) throw new DomainError('REFERRAL_WITHDRAWAL_CONFLICT');
  }
}
