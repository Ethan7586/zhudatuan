import { canonicalCall, canonicalClient, sessionContext } from './canonicalApiClient';
import { nonNegativeInteger, record, records, text, version } from './canonicalShape';
import { ProductionApiError } from './productionApi.error';
import { requestWechatJsapiPayment } from './wechatJsapiPayment';

export interface CanonicalCheckoutInput {
  readonly addressId: string;
  readonly items: readonly Readonly<{ listingId: string; quantity: number }>[];
  readonly idempotencyKey: string;
}

export interface CanonicalCheckoutResult {
  readonly orderId: string;
  readonly paymentState: 'captured' | 'authorizing' | 'reconciling';
}

export interface PaymentConfirmationOptions {
  readonly attempts: number;
  readonly wait: () => Promise<void>;
}

const DEFAULT_CONFIRMATION: PaymentConfirmationOptions = Object.freeze({
  attempts: 45,
  wait: () => new Promise<void>((resolve) => window.setTimeout(resolve, 1_000)),
});

export async function checkoutWithCanonicalPayment(
  input: CanonicalCheckoutInput,
  confirmation: PaymentConfirmationOptions = DEFAULT_CONFIRMATION,
): Promise<CanonicalCheckoutResult> {
  const client = canonicalClient();
  const [cartValue, accountValue] = await Promise.all([
    canonicalCall(() => client.cart.currentRead({}, sessionContext())),
    canonicalCall(() => client.benefit.accountsRead({ query: { limit: 100 } }, sessionContext())),
  ]);
  const cart = record(cartValue, 'cart.current');
  assertCartMatches(records(cart.items ?? [], 'cart.current.items'), input.items);
  const benefits = benefitChoices(accountValue);
  const quoteValue = await canonicalCall(() => client.checkout.quoteCreate({
    body: { address: input.addressId, invoice: null, delivery: {}, vouchers: [], benefits },
  }, sessionContext({ write: true, idempotencyKey: `${input.idempotencyKey}:quote`, expectedVersion: version(cart.version ?? 0, 'cart.current.version') })));
  const quoteEnvelope = record(quoteValue, 'checkout.quote');
  const quote = record(quoteEnvelope.quote, 'checkout.quote.quote');
  const rejections = records(quote.rejections ?? [], 'checkout.quote.rejections');
  if (rejections.length > 0) {
    throw new ProductionApiError('购物车中存在后端拒绝结算的商品，请刷新后重试', 409, 'CHECKOUT_REJECTED');
  }
  const personalMinor = nonNegativeInteger(quote.personalMinor, 'checkout.quote.personalMinor');

  const orderValue = await canonicalCall(() => client.order.ordersCreate({ body: { quote: text(quote.id, 'checkout.quote.id') } }, sessionContext({
    write: true,
    idempotencyKey: `${input.idempotencyKey}:order`,
  })));
  const order = record(orderValue, 'order.create');
  const paymentPlan = record(order.payment, 'order.create.payment');
  if (nonNegativeInteger(paymentPlan.personalMinor, 'order.create.payment.personalMinor') !== personalMinor) {
    throw new ProductionApiError('订单支付计划与报价不一致，请刷新后重试', 409, 'PAYMENT_PLAN_CHANGED');
  }
  const orderId = text(order.id, 'order.create.id');
  const paymentValue = await canonicalCall(() => client.payment.intentsCreate({ body: { order: orderId, scene: 'jsapi' } }, sessionContext({
    write: true,
    idempotencyKey: `${input.idempotencyKey}:payment`,
  })));
  const payment = record(paymentValue, 'payment.intent');
  if (payment.state === 'captured') return Object.freeze({ orderId, paymentState: 'captured' });
  if (payment.parameters !== undefined) {
    await requestWechatJsapiPayment(payment.parameters);
    return Object.freeze({ orderId, paymentState: await waitForPaymentConfirmation(client, orderId, confirmation) });
  }
  if (payment.state === 'authorizing' || payment.state === 'reconciling') {
    return Object.freeze({ orderId, paymentState: payment.state });
  }
  const state = typeof payment.state === 'string' ? payment.state : 'unknown';
  throw new ProductionApiError(`支付未完成，服务端状态为 ${state}`, 409, 'PAYMENT_NOT_STARTED');
}

async function waitForPaymentConfirmation(
  client: ReturnType<typeof canonicalClient>,
  orderId: string,
  options: PaymentConfirmationOptions,
): Promise<'captured' | 'reconciling'> {
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    const value = record(await canonicalCall(() => client.order.ordersRead({ query: { limit: 100 } }, sessionContext())), 'order.orders');
    const order = records(value.items ?? [], 'order.orders.items').find((item) => item.id === orderId);
    if (order?.payment_state === 'paid' || (typeof order?.payment_state === 'string' && order.payment_state.includes('refund'))) {
      return 'captured';
    }
    if (attempt + 1 < options.attempts) await options.wait();
  }
  return 'reconciling';
}

function assertCartMatches(serverItems: readonly Record<string, unknown>[], expectedItems: CanonicalCheckoutInput['items']): void {
  const server = serverItems.map((item) => `${text(item.listing, 'cart.item.listing')}:${nonNegativeInteger(item.quantity, 'cart.item.quantity')}`).sort();
  const expected = expectedItems.map((item) => `${item.listingId}:${item.quantity}`).sort();
  if (server.length !== expected.length || server.some((value, index) => value !== expected[index])) {
    throw new ProductionApiError('购物车已发生变化，请刷新后重新结算', 409, 'CART_CHANGED');
  }
}

function benefitChoices(value: unknown): Array<{ account: string; amountMinor: number }> {
  const source = record(value, 'benefit.accounts');
  return records(source.items ?? [], 'benefit.accounts.items').flatMap((item) => {
    const kind = typeof item.kind === 'string' ? item.kind : '';
    const amountMinor = nonNegativeInteger(item.available_minor, 'benefit.account.available_minor');
    if (!['welfare', 'meal', 'allowance'].includes(kind) || item.currency !== 'CNY' || amountMinor === 0) return [];
    return [{ account: text(item.id, 'benefit.account.id'), amountMinor }];
  });
}
