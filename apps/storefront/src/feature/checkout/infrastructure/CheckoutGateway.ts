import type { CheckoutOperations } from '@shop/sdk/checkout';
import type { OrderOperations } from '@shop/sdk/order';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../../../entity/session';
import type { CheckoutPort, CommittedOrder, PaymentScene, QuoteRequest } from '../public/CheckoutPort';
import type { Quote } from '../model/Quote';
import { mapQuote } from './CheckoutMapper';

export class CheckoutGateway implements CheckoutPort {
  constructor(
    private readonly checkout: CheckoutOperations,
    private readonly order: OrderOperations,
    private readonly context: RequestContextFactory
  ) {}
  async quote(session: StorefrontSession, body: QuoteRequest, idempotencyKey: string): Promise<Quote> {
    const request = {
      cartVersion: body.cartVersion,
      lines: [...body.lines],
      ...(body.addressId ? { addressId: body.addressId } : {}),
      ...(body.invoiceId ? { invoiceId: body.invoiceId } : {}),
      delivery: body.delivery,
      voucherIds: [...body.voucherIds],
      benefits: [...body.benefits],
      paymentScene: body.paymentScene,
    };
    return mapQuote(await this.checkout.quoteCreate({ body: request }, this.context(session, { write: true, idempotencyKey })));
  }
  async current(session: StorefrontSession, signal?: AbortSignal): Promise<Quote | null> {
    const value = await this.checkout.quotesCurrentRead({}, this.context(session, { signal }));
    return value.quote ? mapQuote(value.quote) : null;
  }
  async commit(session: StorefrontSession, quoteId: string, confirmationToken: string, paymentScene: PaymentScene, idempotencyKey: string): Promise<CommittedOrder> {
    const value = await this.order.ordersCreate({ body: { quoteId, confirmationToken, paymentScene } }, this.context(session, { write: true, idempotencyKey }));
    return Object.freeze({ orderId: value.order.id, payment: Object.freeze({ paymentId: value.payment.paymentId }) });
  }
}
