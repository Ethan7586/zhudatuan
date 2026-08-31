import { storefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../shared/api/Session';
import type { ContractJsonValue } from '@shop/contract';

export const CheckoutGateway = Object.freeze({
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
    return storefrontClient.commerce.checkout.quoteCreate({ body }, storefrontClient.context(session, { write: true, idempotencyKey }));
  },
  current(session: StorefrontSession, signal?: AbortSignal) {
    return storefrontClient.commerce.checkout.quotesCurrentRead({}, storefrontClient.context(session, { signal }));
  },
  commit(session: StorefrontSession, quoteId: string, paymentScene: 'miniapp' | 'jsapi', idempotencyKey: string) {
    return storefrontClient.commerce.order.ordersCreate({ body: { quoteId, paymentScene } }, storefrontClient.context(session, { write: true, idempotencyKey }));
  },
});
