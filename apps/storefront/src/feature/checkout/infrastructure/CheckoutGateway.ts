import type { StorefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../entity/session';
import type { ContractJsonValue } from '@shop/contract';

export class CheckoutGateway {
  constructor(
    private readonly checkout: StorefrontClient['commerce']['checkout'],
    private readonly order: StorefrontClient['commerce']['order'],
    private readonly context: StorefrontClient['context']
  ) {}
  quote(
    session: StorefrontSession,
    body: Readonly<{
      cartVersion: number;
      lines: readonly Readonly<{ listingId: string; quantity: number; lineVersion: number }>[];
      addressId?: string;
      invoiceId?: string;
      delivery: ContractJsonValue;
      voucherIds: readonly string[];
      benefits: readonly Readonly<{ accountId: string; amountMinor: number }>[];
      paymentScene: 'miniapp' | 'jsapi';
    }>,
    idempotencyKey: string
  ) {
    return this.checkout.quoteCreate({ body }, this.context(session, { write: true, idempotencyKey }));
  }
  current(session: StorefrontSession, signal?: AbortSignal) {
    return this.checkout.quotesCurrentRead({}, this.context(session, { signal }));
  }
  commit(session: StorefrontSession, quoteId: string, paymentScene: 'miniapp' | 'jsapi', idempotencyKey: string) {
    return this.order.ordersCreate({ body: { quoteId, paymentScene } }, this.context(session, { write: true, idempotencyKey }));
  }
}
