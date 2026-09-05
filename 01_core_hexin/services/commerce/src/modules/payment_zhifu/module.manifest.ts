import { defineModuleManifest } from '@shop/kernel';
import { PAYMENT_CAPABILITIES } from './01_public_gongkai/PaymentCapabilities';

export const paymentManifest = defineModuleManifest({
  id: 'payment',
  version: '1.0.0',
  kind: 'business',
  provides: [PAYMENT_CAPABILITIES.read, PAYMENT_CAPABILITIES.manage],
  requires: [
    'benefit.manage',
    'channel.manage',
    'finance.manage',
    'fulfillment.manage',
    'inventory.manage',
    'marketing.manage',
    'order.manage',
    'voucher.manage',
  ],
  operations: [
    'payment.intents.create',
    'payment.intents.read',
    'payment.refunds.request',
    'payment.recoveries.read',
    'payment.recoveries.resolve',
    'payment.webhooks.wechat',
  ],
  publishes: [
    'payment.attempt.failed',
    'payment.autorefund.requested',
    'payment.late.detected',
    'payment.provider.observed',
    'payment.recovery.opened',
  ],
  consumes: ['payment.capture', 'payment.refund', 'payment.signed-notification'],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['paymentOperations', 'PaymentWebhook'],
    jobs: ['PaymentJobProcessor'],
  },
});
