import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { AfterSaleQuery } from '../model/AfterSale';
import type { OrderPort } from '../public';

export class ReadAftersales {
  constructor(private readonly port: OrderPort) {}
  execute(context: ConsoleContext, filter: AfterSaleQuery, signal?: AbortSignal) {
    return this.port.aftersales(context, filter, signal);
  }
}
