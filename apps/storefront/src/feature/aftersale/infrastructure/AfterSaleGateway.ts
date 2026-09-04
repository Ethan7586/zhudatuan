import type { OrderOperations } from '@shop/sdk/order';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import { createIdempotencyKey, uploadObject } from '@shop/sdk';
import type { StorefrontSession } from '../../../entity/session';
import type { AfterSaleApplyReceipt, ApplyAfterSaleInput, AfterSalePage } from '../model/AfterSale';
import type { AfterSaleUploadRequest } from '../public/AfterSalePort';
import { mapAfterSalePage } from './AfterSaleMapper';
import type { AfterSalePort } from '../public/AfterSalePort';

export class AfterSaleGateway implements AfterSalePort {
  constructor(
    private readonly order: OrderOperations,
    private readonly context: RequestContextFactory
  ) {}
  async read(session: StorefrontSession, orderId: string): Promise<AfterSalePage> {
    const value = await this.order.aftersalesRead({ query: { order: orderId, limit: 50 } }, this.context(session));
    return mapAfterSalePage(value);
  }

  async apply(session: StorefrontSession, orderId: string, input: ApplyAfterSaleInput, idempotencyKey: string): Promise<AfterSaleApplyReceipt> {
    const value = await this.order.aftersalesApply(
      { path: { orderid: orderId }, body: { lines: [...input.lines], reason: input.reason, description: input.description, attachments: [...input.attachments] } },
      this.context(session, { write: true, idempotencyKey })
    );
    return Object.freeze({ id: value.id, state: value.state });
  }

  async authorizeAttachment(session: StorefrontSession, orderId: string, input: AfterSaleUploadRequest, idempotencyKey: string) {
    return this.order.aftersaleattachmentsCreate({ path: { orderid: orderId }, body: input }, this.context(session, { write: true, idempotencyKey }));
  }

  async upload(session: StorefrontSession, orderId: string, input: AfterSaleUploadRequest, file: File) {
    const authorization = await this.authorizeAttachment(session, orderId, input, createIdempotencyKey());
    await uploadObject({ url: authorization.upload.url, headers: authorization.upload.headers, body: file }).catch(() => {
      throw new Error('附件直传失败，请重新选择文件');
    });
    return Object.freeze({ objectId: authorization.objectId, ...input });
  }
}
