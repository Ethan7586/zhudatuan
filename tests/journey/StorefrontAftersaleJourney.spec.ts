import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront aftersale journey', {
  operations: ['order.aftersales.read', 'order.aftersales.apply', 'payment.refunds.request'],
  routes: ['/orders/:orderId/aftersales'],
  sources: ['services/commerce/src/modules/order/infrastructure/persistence/AfterSalePersistence.ts', 'services/commerce/src/modules/payment/infrastructure/persistence/RefundSettlement.ts'],
  markers: [/requiresReturn/, /refund/, /version/],
});
