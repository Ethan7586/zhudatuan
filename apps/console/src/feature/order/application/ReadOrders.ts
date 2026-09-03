import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderQuery } from '../model/OrderQuery';
import type { OrderPort } from '../public';

export class ReadOrders {
  constructor(private readonly port: OrderPort) {}
  execute(context: ConsoleContext, filter: OrderQuery, signal?: AbortSignal) {
    return this.port.orders(context, filter, signal);
  }
}
