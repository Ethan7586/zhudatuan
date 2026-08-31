import { storefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../shared/api/Session';
import type { ApplyAfterSaleInput, AfterSalePage } from '../model/AfterSale';
import { mapAfterSalePage } from './AfterSaleMapper';

export const AfterSaleGateway = Object.freeze({
  async read(session: StorefrontSession, orderId: string): Promise<AfterSalePage> {
    const value = await storefrontClient.commerce.order.aftersalesRead({ query: { order: orderId, limit: 50 } }, storefrontClient.context(session));
    return mapAfterSalePage(value);
  },

  async apply(session: StorefrontSession, orderId: string, input: ApplyAfterSaleInput, idempotencyKey: string): Promise<Readonly<{ id: string; state: 'reviewing' }>> {
    const value = await storefrontClient.commerce.order.aftersalesApply(
      { path: { orderid: orderId }, body: { lines: [...input.lines], reason: input.reason, description: input.description, attachments: [...input.attachments] } },
      storefrontClient.context(session, { write: true, idempotencyKey })
    );
    return Object.freeze({ id: value.id, state: value.state });
  },
});
