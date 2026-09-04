import { OP_ORDER_ORDERS_CANCEL } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderDetail } from '../model/Order';
import type { OrderPort } from '../public';
import { assertCommandAccess } from './CommandAccess';

export class CancelOrder {
  constructor(private readonly port: Pick<OrderPort, 'cancel'>) {}

  execute(context: ConsoleContext, order: OrderDetail, reason: string, identity: string, signal?: AbortSignal) {
    assertCommandAccess(context, OP_ORDER_ORDERS_CANCEL, identity);
    if (!['created', 'awaitingpayment'].includes(order.lifecycle_state) || !['unpaid', 'authorizing', 'failed'].includes(order.payment_state) || reason.trim().length < 2) throw new Error('ORDER_NOT_CANCELLABLE');
    return this.port.cancel(context, order, reason, identity, signal);
  }
}
