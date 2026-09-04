import { OP_FULFILLMENT_SHIPMENTS_CREATE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderFulfillment } from '../model/Order';
import type { OrderPort } from '../public';
import { assertCommandAccess } from './CommandAccess';

export class ShipOrder {
  constructor(private readonly port: Pick<OrderPort, 'ship'>) {}
  execute(context: ConsoleContext, target: OrderFulfillment, tracking: string, carrier: string, identity: string, signal?: AbortSignal) {
    assertCommandAccess(context, OP_FULFILLMENT_SHIPMENTS_CREATE, identity);
    return this.port.ship(context, target, tracking, carrier, identity, signal);
  }
}
