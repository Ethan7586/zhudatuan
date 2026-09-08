import { DomainError } from '../../../../platform/error/DomainError';
import type { CommerceState, FulfillmentState, PaymentState } from '../model/Order';

export class ReceiptPolicy {
  assert(input: Readonly<{ commerce: CommerceState; payment: PaymentState; fulfillment: FulfillmentState }>): void {
    if (!['shipped', 'delivered'].includes(input.fulfillment) || ['cancelled', 'closed'].includes(input.commerce) || input.payment === 'refunded') {
      throw new DomainError('ORDER_RECEIPT_STATE_INVALID');
    }
  }
}
