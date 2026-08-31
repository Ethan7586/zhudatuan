import { DomainError } from '../../../../foundation/domain/DomainError';

export type AfterSaleLifecycle = 'applied' | 'reviewing' | 'approved' | 'returning' | 'received' | 'refunding' | 'resolved' | 'rejected';

const transitions = {
  applied: ['reviewing'],
  reviewing: ['approved', 'rejected'],
  approved: ['returning', 'refunding'],
  returning: ['received'],
  received: ['refunding'],
  refunding: ['resolved'],
  resolved: [],
  rejected: [],
} as const satisfies Readonly<Record<AfterSaleLifecycle, readonly AfterSaleLifecycle[]>>;

export class AfterSale {
  private constructor(readonly state: AfterSaleLifecycle) {}

  static from(state: string): AfterSale {
    if (!(state in transitions)) throw new DomainError('ORDER_AFTERSALE_NOT_ALLOWED');
    return new AfterSale(state as AfterSaleLifecycle);
  }

  transition(next: AfterSaleLifecycle): AfterSaleLifecycle {
    const allowed = transitions[this.state] as readonly AfterSaleLifecycle[];
    if (!allowed.includes(next)) throw new DomainError('ORDER_AFTERSALE_NOT_ALLOWED');
    return next;
  }
}
