import { DomainError } from '../../../../foundation/domain/DomainError';
import { Entity } from '../../../../foundation/domain/Entity';

export type CommerceState = 'created' | 'active' | 'completed' | 'cancelled' | 'closed';
export type PaymentState = 'unpaid' | 'authorizing' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
export type FulfillmentState = 'unallocated' | 'allocated' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type AftersaleState = 'none' | 'requested' | 'processing' | 'resolved' | 'rejected';

export class Order extends Entity {
  constructor(id: string, readonly commerce: CommerceState, readonly payment: PaymentState, readonly fulfillment: FulfillmentState, readonly aftersale: AftersaleState) {
    super(id);
  }
  assertCancellable(): void {
    if (!['created', 'active'].includes(this.commerce) || !['unallocated', 'allocated'].includes(this.fulfillment)) throw new DomainError('ORDER_NOT_CANCELLABLE');
  }

  assertAftersaleAllowed(): void {
    if (!['active', 'completed'].includes(this.commerce) || this.payment === 'unpaid' || this.payment === 'refunded' || this.aftersale === 'processing') throw new DomainError('ORDER_AFTERSALE_NOT_ALLOWED');
  }
}
