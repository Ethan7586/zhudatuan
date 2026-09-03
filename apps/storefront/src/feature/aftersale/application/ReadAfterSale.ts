import { AfterSaleGateway } from '../infrastructure/AfterSaleGateway';
import type { AfterSalePage } from '../model/AfterSale';
import type { StorefrontSession } from '../../../entity/session';

export class ReadAfterSale {
  constructor(private readonly gateway: Pick<AfterSaleGateway, 'read'>) {}
  execute(session: StorefrontSession, orderId: string): Promise<AfterSalePage> {
    if (!orderId) return Promise.reject(new Error('AFTERSALE_ORDER_REQUIRED'));
    return this.gateway.read(session, orderId);
  }
}
