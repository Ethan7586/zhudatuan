import { describe, expect, it, vi } from 'vitest';
import { cartViewModel } from '../miniprogram/feature/cart/viewmodel/CartViewModel';
import { checkoutViewModel } from '../miniprogram/feature/checkout/viewmodel/CheckoutViewModel';
import { paymentViewModel } from '../miniprogram/feature/payment/viewmodel/PaymentViewModel';
import { productViewModel } from '../miniprogram/feature/product/viewmodel/ProductViewModel';

const context = Object.freeze({ traceId: 'trace:miniapp' });

describe('miniapp purchase journey', () => {
  it('keeps server versions and amounts from product through payment return', async () => {
    const itemsPut = vi.fn(async () => ({}));
    const productClient = { cart: { currentRead: vi.fn(async () => ({ version: 7 })), itemsPut }, member: { favoritesPut: vi.fn() } };
    const catalog = { items: [{ id: 'listing:one', product: 'product:one', saleability: { state: 'saleable' } }] };
    await productViewModel.execute!(productClient as never, context as never, { id: 'miniappproduct', parameters: { productId: 'product:one' } }, catalog, productViewModel.actions!(catalog, { id: 'miniappproduct', parameters: { productId: 'product:one' } })[0]!, { quantity: '2' });
    expect(itemsPut).toHaveBeenCalledWith(expect.objectContaining({ path: { listingid: 'listing:one' }, body: expect.objectContaining({ quantity: 2 }) }), expect.objectContaining({ expectedVersion: 7 }));

    const cart = { version: 8, items: [{ listing: 'listing:one', sku: 'sku:one', title: '节日礼盒', quantity: 2, selected: true, version: 3, validity: { state: 'valid' } }] };
    const checkoutAction = cartViewModel.actions!(cart, { id: 'miniappcart', parameters: {} }).find(({ id }) => id === 'checkout')!;
    await expect(cartViewModel.execute!({} as never, context as never, { id: 'miniappcart', parameters: {} }, cart, checkoutAction, {})).resolves.toMatchObject({ destination: expect.stringContaining('miniappcheckout') });

    const quoteCreate = vi.fn(async () => ({}));
    const checkoutClient = {
      cart: { currentRead: vi.fn(async () => cart) }, member: { addressesRead: vi.fn(async () => ({ items: [{ id: 'address:one', is_default: true, status: 'active' }] })) },
      checkout: { quoteCreate }, order: { ordersCreate: vi.fn() },
    };
    const quoteAction = checkoutViewModel.actions!({ quote: null }, { id: 'miniappcheckout', parameters: {} })[0]!;
    await checkoutViewModel.execute!(checkoutClient as never, context as never, { id: 'miniappcheckout', parameters: {} }, { quote: null }, quoteAction, { note: '工作日配送' });
    expect(quoteCreate).toHaveBeenCalledWith({ body: expect.objectContaining({ cartVersion: 8, lines: [{ listingId: 'listing:one', quantity: 2, lineVersion: 3 }], addressId: 'address:one', paymentScene: 'miniapp' }) }, context);

    const payment = { intentId: 'intent:one', orderId: 'order:one', paymentId: 'payment:one', state: 'pending', action: { timeStamp: '1', nonceStr: 'n', package: 'prepay_id=one', signType: 'RSA', paySign: 'signature' }, expiresAt: '2026-09-08T00:00:00.000Z', retryAfter: 0 };
    const payAction = paymentViewModel.actions!(payment, { id: 'miniapppayment', parameters: { paymentId: 'payment:one' } })[0]!;
    await expect(paymentViewModel.execute!({} as never, context as never, { id: 'miniapppayment', parameters: { paymentId: 'payment:one' } }, payment, payAction, {})).resolves.toEqual({ message: '微信支付已返回，正在核验服务端结果。', payment: payment.action });
  });
});
