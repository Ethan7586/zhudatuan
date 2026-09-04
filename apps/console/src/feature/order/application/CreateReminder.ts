import { OP_ORDER_REMINDERS_CREATE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderDetail } from '../model/Order';
import type { OrderPort } from '../public';
import { assertCommandAccess } from './CommandAccess';

export class CreateReminder {
  constructor(private readonly port: Pick<OrderPort, 'remind'>) {}
  execute(context: ConsoleContext, order: OrderDetail, identity: string, signal?: AbortSignal) {
    assertCommandAccess(context, OP_ORDER_REMINDERS_CREATE, identity);
    if (!['paid', 'fulfilling', 'shipped'].includes(order.lifecycle_state) || ['received', 'cancelled', 'returned'].includes(order.fulfillment_state)) throw new Error('ORDER_REMINDER_NOT_ALLOWED');
    return this.port.remind(context, order, identity, signal);
  }
}
