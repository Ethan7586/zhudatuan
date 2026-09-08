import { DomainError } from '../../../../platform/error/DomainError';
import { Entity } from '@shop/kernel';
import { OrderTransition } from '../policy/OrderTransition';
import { OrderAddress, type OrderAddressSnapshot } from './OrderAddress';
import { OrderFulfillment, type OrderFulfillmentSnapshot } from './OrderFulfillment';
import { OrderLine, type OrderLineSnapshot } from './OrderLine';
import { OrderPayment, type OrderPaymentSnapshot } from './OrderPayment';

export type CommerceState = 'created' | 'awaitingpayment' | 'paid' | 'fulfilling' | 'shipped' | 'received' | 'completed' | 'cancelled';
export type PaymentState = 'unpaid' | 'authorizing' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
export type FulfillmentState = 'unallocated' | 'allocated' | 'processing' | 'shipped' | 'delivered' | 'received' | 'cancelled' | 'returned';
export type AftersaleState = 'none' | 'applied' | 'reviewing' | 'approved' | 'returning' | 'received' | 'refunding' | 'resolved' | 'rejected';

export interface OrderTransactionSnapshot {
  readonly lines: readonly OrderLineSnapshot[];
  readonly address: OrderAddressSnapshot | null;
  readonly payment: OrderPaymentSnapshot;
  readonly fulfillment: OrderFulfillmentSnapshot;
}

export interface FrozenOrderTransactionSnapshot {
  readonly lines: readonly OrderLineSnapshot[];
  readonly address: OrderAddressSnapshot | null;
  readonly payment: OrderPaymentSnapshot;
  readonly fulfillment: OrderFulfillmentSnapshot;
}

export class Order extends Entity {
  private readonly transitions = new OrderTransition();
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

  transition(next: Readonly<{ commerce?: CommerceState; payment?: PaymentState; fulfillment?: FulfillmentState; aftersale?: AftersaleState }>): void {
    if (next.commerce !== undefined) this.transitions.lifecycle(this.commerce, next.commerce);
    if (next.payment !== undefined) this.transitions.payment(this.payment, next.payment);
    if (next.fulfillment !== undefined) this.transitions.fulfillment(this.fulfillment, next.fulfillment);
    if (next.aftersale !== undefined) this.transitions.aftersale(this.aftersale, next.aftersale);
  }

  static freezeSnapshot(value: OrderTransactionSnapshot): FrozenOrderTransactionSnapshot {
    return Object.freeze({
      lines: Object.freeze(value.lines.map((line) => OrderLine.freeze(line).value)),
      address: OrderAddress.freeze(value.address).value,
      payment: OrderPayment.freeze(value.payment).value,
      fulfillment: OrderFulfillment.freeze(value.fulfillment).value,
    });
  }
}
