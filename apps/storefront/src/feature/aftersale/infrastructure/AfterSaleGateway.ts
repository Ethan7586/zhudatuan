import type { StorefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../entity/session';
import type { ApplyAfterSaleInput, AfterSalePage } from '../model/AfterSale';
import { mapAfterSalePage } from './AfterSaleMapper';

export class AfterSaleGateway {
  constructor(private readonly order: StorefrontClient['commerce']['order'], private readonly context: StorefrontClient['context']) {}
  async read(session: StorefrontSession, orderId: string): Promise<AfterSalePage> {
    const value = await this.order.aftersalesRead({ query: { order: orderId, limit: 50 } }, this.context(session));
    return mapAfterSalePage(value);
  }

  async apply(session: StorefrontSession, orderId: string, input: ApplyAfterSaleInput, idempotencyKey: string): Promise<Readonly<{ id: string; state: 'reviewing' }>> {
    const value = await this.order.aftersalesApply(
      { path: { orderid: orderId }, body: { lines: [...input.lines], reason: input.reason, description: input.description, attachments: [...input.attachments] } },
      this.context(session, { write: true, idempotencyKey })
    );
    return Object.freeze({ id: value.id, state: value.state });
  }

  async authorizeAttachment(session: StorefrontSession, orderId: string, input: Readonly<{ name: string; contentType: 'image/jpeg' | 'image/png' | 'application/pdf'; sizeBytes: number; sha256: string }>, idempotencyKey: string) {
    return this.order.aftersaleattachmentsCreate({ path: { orderid: orderId }, body: input }, this.context(session, { write: true, idempotencyKey }));
  }
}
