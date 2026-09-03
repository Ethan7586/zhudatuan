import type { StorefrontSession } from '../../../entity/session';
import type { EnterpriseMall } from '../../account/model/Profile';
import type { Order } from '../model/Order';
import { OrderGateway } from '../infrastructure/OrderGateway';
import { mapOrders } from '../infrastructure/OrderMapper';

export class ReadOrders {
  constructor(private readonly gateway: Pick<OrderGateway, 'orders'>) {}
  async execute(session: StorefrontSession, mall: EnterpriseMall, signal?: AbortSignal): Promise<readonly Order[]> {
    return mapOrders(await this.gateway.orders(session, signal), mall);
  }
}
