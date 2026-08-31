import type { StorefrontSession } from '../../../shared/api/Session';
import type { MallView } from '../../../shared/runtime/StorefrontPort';
import type { Order } from '../model/Order';
import { OrderGateway } from '../infrastructure/OrderGateway';
import { mapOrders } from '../infrastructure/OrderMapper';

export class ReadOrders {
  async execute(session: StorefrontSession, mall: MallView, signal?: AbortSignal): Promise<readonly Order[]> {
    return mapOrders(await OrderGateway.orders(session, signal), mall);
  }
}
