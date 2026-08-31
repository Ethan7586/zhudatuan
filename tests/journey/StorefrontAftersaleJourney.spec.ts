import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront aftersale journey', {
  operations: ['order.aftersales.read', 'order.aftersales.apply', 'payment.refunds.request'],
  routes: ['/orders/:orderId/aftersales'],
  sources: ['services/commerce/src/modules/order/application/AfterSaleService.ts', 'services/commerce/src/modules/payment/application/RefundSettlement.ts'],
  markers: [/requiresReturn/, /refund/, /version/],
});
