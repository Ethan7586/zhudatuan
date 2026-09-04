import { defineModuleManifest } from '@shop/kernel';
import { ORDER_CAPABILITIES } from './01_public_gongkai/OrderCapabilities';

export const orderManifest = defineModuleManifest({
  id: 'order',
  version: '1.0.0',
  kind: 'business',
  provides: [ORDER_CAPABILITIES.read, ORDER_CAPABILITIES.manage],
  requires: [
    'benefit.manage',
    'cart.manage',
    'checkout.manage',
    'inventory.manage',
    'marketing.manage',
    'payment.manage',
    'reporting.manage',
    'voucher.manage',
  ],
  operations: [
    'order.orders.create',
    'order.orders.read',
    'order.reminders.create',
    'order.orders.export',
    'order.aftersales.read',
    'order.aftersales.apply',
    'order.aftersales.approve',
    'order.aftersales.reject',
  ],
  publishes: ['checkout.quote.confirmed', 'inventory.stock.reserved', 'order.placed'],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'interface', 'tests'],
  entrypoints: {
    http: ['orderOperations'],
    jobs: ['orderexpiry'],
  },
});
