import { OP_ORDER_ORDERS_RECEIVE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderDetail } from '../model/Order';
import type { OrderPort } from '../public';
import { assertCommandAccess } from './CommandAccess';

export class ReceiveOrder {
  constructor(private readonly port: Pick<OrderPort, 'receive'>) {}
  execute(context: ConsoleContext, order: OrderDetail, reason: string, identity: string, signal?: AbortSignal) {
    assertCommandAccess(context, OP_ORDER_ORDERS_RECEIVE, identity);
    if (!['shipped', 'delivered'].includes(order.fulfillment_state) || reason.trim().length < 2) throw new Error('ORDER_RECEIPT_STATE_INVALID');
    return this.port.receive(context, order, reason, identity, signal);
  }
}
