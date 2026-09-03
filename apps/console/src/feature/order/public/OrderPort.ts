import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { AfterSalePage, AfterSaleQuery } from '../model/AfterSale';
import type { OrderPage, OrderRecord } from '../model/Order';
import type { OrderQuery } from '../model/OrderQuery';

export interface OrderPort {
  orders(context: ConsoleContext, filter: OrderQuery, signal?: AbortSignal): Promise<OrderPage>;
  order(context: ConsoleContext, reference: string, signal?: AbortSignal): Promise<OrderRecord | undefined>;
  aftersales(context: ConsoleContext, filter: AfterSaleQuery, signal?: AbortSignal): Promise<AfterSalePage>;
}
