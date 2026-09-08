import { Money } from '@shop/kernel';
import { DomainError } from '../../../../platform/error/DomainError';

export interface TenderAllocation {
  readonly tender: string;
  readonly amount: Money;
  readonly refundable: Money;
}

export class AllocationPolicy {
  allocateRefund(allocations: readonly TenderAllocation[], requested: Money): readonly Readonly<{ tender: string; amount: Money }>[] {
    let remaining = requested;
    const result: Array<Readonly<{ tender: string; amount: Money }>> = [];
    for (const allocation of [...allocations].reverse()) {
      const amount = Money.of(Math.min(allocation.refundable.minor, remaining.minor), remaining.currency.code);
      if (amount.minor > 0) result.push({ tender: allocation.tender, amount });
      remaining = remaining.subtract(amount);
    }
    if (remaining.minor !== 0) throw new DomainError('PAYMENT_REFUND_EXCEEDS_AVAILABLE');
    return result;
  }
}
