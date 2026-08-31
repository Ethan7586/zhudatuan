import { DomainError } from '../../../../foundation/domain/DomainError';
import { Entity } from '../../../../foundation/domain/Entity';

export type CommerceState = 'created' | 'awaitingpayment' | 'paid' | 'fulfilling' | 'shipped' | 'received' | 'completed' | 'cancelled';
export type PaymentState = 'unpaid' | 'authorizing' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
export type FulfillmentState = 'unallocated' | 'allocated' | 'processing' | 'shipped' | 'delivered' | 'received' | 'cancelled' | 'returned';
export type AftersaleState = 'none' | 'applied' | 'reviewing' | 'approved' | 'returning' | 'received' | 'refunding' | 'resolved' | 'rejected';

export class Order extends Entity {
  constructor(
    id: string,
    readonly commerce: CommerceState,
    readonly payment: PaymentState,
    readonly fulfillment: FulfillmentState,
    readonly aftersale: AftersaleState
  ) {
    super(id);
  }
  assertCancellable(): void {
    if (!['created', 'awaitingpayment'].includes(this.commerce) || !['unallocated', 'allocated'].includes(this.fulfillment)) throw new DomainError('ORDER_NOT_CANCELLABLE');
  }

  assertAftersaleAllowed(): void {
    if (!['paid', 'fulfilling', 'shipped', 'received', 'completed'].includes(this.commerce) || this.payment === 'unpaid' || this.payment === 'refunded') throw new DomainError('ORDER_AFTERSALE_NOT_ALLOWED');
  }
}
