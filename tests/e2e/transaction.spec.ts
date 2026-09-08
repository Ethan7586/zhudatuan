import { test } from '@playwright/test';
import { runConsoleJourney, runStorefrontJourney } from './JourneyRuntime';

test('anonymous purchase', async ({ page }) => runStorefrontJourney(page, {
  scenario: 'anonymous purchase', path: '/cart', assertions: ['浏览', 'Cart', '地址', 'Quote', 'Order', 'Payment'],
  operations: ['storefront.catalog.read', 'cart.current.read', 'member.addresses.read', 'checkout.quote.create', 'order.orders.create', 'payment.intents.create'],
}));

test('benefit purchase', async ({ page }) => runStorefrontJourney(page, {
  scenario: 'benefit purchase', path: '/benefits', assertions: ['福利预留', '消费', '订单完成', '账本'],
  operations: ['benefit.accounts.read', 'benefit.grants.create', 'benefit.ledgers.read', 'order.orders.read'],
}));

test('voucher tender', async ({ page }) => runStorefrontJourney(page, {
  scenario: 'voucher tender', path: '/vouchers', assertions: ['Hold', '核销', '支付分摊', '收据'],
  operations: ['voucher.redemptions.quote', 'voucher.tenderholds.create', 'voucher.tenderholds.consume', 'voucher.redemptions.create'],
}));

test('delayed payment', async ({ page }) => runConsoleJourney(page, {
  scenario: 'delayed payment', path: '/orders', assertions: ['超时', '迟到回调', '恢复', '库存和权益处理'],
  operations: ['payment.recoveries.read', 'payment.recoveries.resolve', 'order.orders.read'],
}));

test('channel fulfillment', async ({ page }) => runConsoleJourney(page, {
  scenario: 'channel fulfillment', path: '/orders', assertions: ['供应商下单', '幂等', '物流', '回调'],
  operations: ['fulfillment.workitems.read', 'fulfillment.workitems.transition', 'fulfillment.tracking.read', 'channel.operations.read'],
}));

test('aftersale refund', async ({ page }) => runStorefrontJourney(page, {
  scenario: 'aftersale refund', path: '/orders', assertions: ['申请', '审批', '退货', '退款', '库存福利佣金冲正'],
  operations: ['order.aftersales.read', 'order.aftersales.apply', 'payment.refunds.request'],
}));

test('order import', async ({ page }) => runConsoleJourney(page, {
  scenario: 'order import', path: '/orders', assertions: ['来源证明', '重复键', '金额', '映射', '回读'],
  operations: ['runtime.uploads.create', 'order.imports.create', 'order.imports.read', 'order.orders.read'],
}));
