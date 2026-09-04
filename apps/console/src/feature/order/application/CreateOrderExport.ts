import { OP_ORDER_ORDERS_EXPORT } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderListFilter } from '../model/OrderFilter';
import type { OrderPort } from '../public';
import { assertCommandAccess } from './CommandAccess';

export class CreateOrderExport {
  constructor(private readonly port: Pick<OrderPort, 'createExport'>) {}
  execute(context: ConsoleContext, filter: OrderListFilter, identity: string, signal?: AbortSignal) {
    assertCommandAccess(context, OP_ORDER_ORDERS_EXPORT, identity);
    return this.port.createExport(context, filter, identity, signal);
  }
}
