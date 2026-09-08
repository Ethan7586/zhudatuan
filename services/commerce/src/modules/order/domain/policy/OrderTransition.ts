import { DomainError } from '../../../../platform/error/DomainError';
import type { AftersaleState, CommerceState, FulfillmentState, PaymentState } from '../model/Order';

const lifecycle = transitions<CommerceState>({
  created: ['awaitingpayment', 'cancelled'],
  awaitingpayment: ['paid', 'cancelled'],
  paid: ['fulfilling', 'shipped', 'received', 'completed'],
  fulfilling: ['shipped', 'received', 'completed'],
  shipped: ['received', 'completed'],
  received: ['completed'],
  completed: [],
  cancelled: [],
});
const payment = transitions<PaymentState>({
  unpaid: ['authorizing', 'paid', 'failed'],
  authorizing: ['unpaid', 'paid', 'failed'],
  paid: ['partially_refunded', 'refunded'],
  partially_refunded: ['partially_refunded', 'refunded'],
  refunded: [],
  failed: ['unpaid', 'paid'],
});
const fulfillment = transitions<FulfillmentState>({
  unallocated: ['allocated', 'cancelled'],
  allocated: ['processing', 'shipped', 'delivered', 'cancelled'],
  processing: ['shipped', 'delivered', 'cancelled'],
  shipped: ['delivered', 'received', 'returned'],
  delivered: ['received', 'returned'],
  received: ['returned'],
  cancelled: [],
  returned: [],
});
const aftersale = transitions<AftersaleState>({
  none: ['applied'],
  applied: ['reviewing'],
  reviewing: ['approved', 'rejected'],
  approved: ['returning', 'refunding'],
  returning: ['received'],
  received: ['refunding'],
  refunding: ['resolved'],
  resolved: [],
  rejected: [],
});

export class OrderTransition {
  lifecycle(previous: CommerceState, next: CommerceState): void {
    assert(lifecycle, previous, next);
  }
  payment(previous: PaymentState, next: PaymentState): void {
    assert(payment, previous, next);
  }
  fulfillment(previous: FulfillmentState, next: FulfillmentState): void {
    assert(fulfillment, previous, next);
  }
  aftersale(previous: AftersaleState, next: AftersaleState): void {
    assert(aftersale, previous, next);
  }
}

function transitions<T extends string>(value: Readonly<Record<T, readonly T[]>>): Readonly<Record<T, ReadonlySet<T>>> {
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([state, values]) => [state, new Set(values as T[])])) as unknown as Record<T, ReadonlySet<T>>);
}

function assert<T extends string>(catalog: Readonly<Record<T, ReadonlySet<T>>>, previous: T, next: T): void {
  if (previous === next || !catalog[previous]?.has(next)) throw new DomainError('ORDER_TRANSITION_INVALID', { previous, next });
}
