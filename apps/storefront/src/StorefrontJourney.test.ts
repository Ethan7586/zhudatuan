import { describe, expect, it, vi } from 'vitest';
import type { StorefrontSession } from './entity/session';
import type { Product } from './entity/product';
import { ReadProduct } from './feature/product/application/ReadProduct';
import { ChangeCart } from './feature/cart/application/ChangeCart';
import type { CartAccess, CartChange } from './feature/cart/public/CartPort';
import { CreateQuote } from './feature/checkout/application/CreateQuote';
import { CommitOrder } from './feature/checkout/application/CommitOrder';
import type { Quote } from './feature/checkout/model/Quote';
import { checkoutDraft } from './feature/checkout/model/CheckoutDraft';
import type { PaymentScene, QuoteRequest } from './feature/checkout/public/CheckoutPort';
import { ReadPayment } from './feature/payment/application/ReadPayment';
import type { Payment } from './feature/payment/model/Payment';

describe('storefront product-to-payment journey', () => {
  it('carries server references through product, cart, quote, order, and payment without calculating money locally', async () => {
    const calls: string[] = [];
    const product = { productId: 'product:one', listingId: 'listing:one', skuId: 'sku:one', version: 'listing:7' } as Product;
    const quote = { quoteId: 'quote:one', confirmationToken: 'a'.repeat(43), payableMinor: 8800, selection: { paymentScene: 'jsapi' } } as Quote;
    const payment = { paymentId: 'payment:one', orderId: 'order:one', state: 'pending', retryAfter: 3 } as Payment;
    const productPort = { read: vi.fn(async () => { calls.push('product'); return product; }) };
    const cartPort = { put: vi.fn(async (_access: CartAccess, _input: CartChange) => { calls.push('cart'); }), batch: vi.fn() };
    const checkoutPort = {
      quote: vi.fn(async (_session: StorefrontSession, _input: QuoteRequest, _key: string) => { calls.push('quote'); return quote; }),
      commit: vi.fn(async (_session: StorefrontSession, _quoteId: string, _token: string, _scene: PaymentScene, _key: string) => { calls.push('order'); return { orderId: payment.orderId, payment: { paymentId: payment.paymentId } }; }),
    };
    const paymentPort = { read: vi.fn(async () => { calls.push('payment'); return payment; }) };

    const selected = await new ReadProduct(productPort).execute(product.productId);
    if (!selected) throw new Error('TEST_PRODUCT_MISSING');
    await new ChangeCart(cartPort).execute({ session, csrfToken: session.csrfToken }, { listingId: selected.listingId, quantity: 1, lineVersion: null, cartVersion: 0 });
    const draft = checkoutDraft({ cartVersion: 1, lines: [{ listingId: selected.listingId, quantity: 1, lineVersion: 1 }], addressId: 'address:one', voucherIds: [], benefits: [] });
    const priced = await new CreateQuote(checkoutPort).execute(session, draft);
    const order = await new CommitOrder(checkoutPort).execute(session, priced.quoteId, priced.confirmationToken!, priced.selection.paymentScene);
    const result = await new ReadPayment(paymentPort).execute(session, order.payment.paymentId);

    expect(calls).toEqual(['product', 'cart', 'quote', 'order', 'payment']);
    expect(priced.payableMinor).toBe(8800);
    expect(result).toBe(payment);
    expect(cartPort.put.mock.calls[0]?.[1]?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(checkoutPort.quote.mock.calls[0]?.[1]).toMatchObject({ lines: [{ listingId: 'listing:one', quantity: 1, lineVersion: 1 }], addressId: 'address:one' });
    expect(checkoutPort.commit.mock.calls[0]?.slice(1, 4)).toEqual(['quote:one', 'a'.repeat(43), 'jsapi']);
  });
});

const session = Object.freeze<StorefrontSession>({
  membership: 'membership:one',
  scope: { kind: 'mall', id: 'mall:one' },
  accessVersion: 7,
  csrfToken: 'csrf:one',
});
