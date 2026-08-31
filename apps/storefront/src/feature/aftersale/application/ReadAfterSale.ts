import { AfterSaleGateway } from '../infrastructure/AfterSaleGateway';
import type { AfterSalePage } from '../model/AfterSale';
import type { StorefrontSession } from '../../../shared/api/Session';

export function readAfterSale(session: StorefrontSession, orderId: string): Promise<AfterSalePage> {
  if (!orderId) return Promise.reject(new Error('AFTERSALE_ORDER_REQUIRED'));
  return AfterSaleGateway.read(session, orderId);
}
