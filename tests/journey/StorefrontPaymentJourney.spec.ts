import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront payment journey', {
  operations: ['order.orders.create', 'payment.intents.read'],
  routes: ['/checkout', '/payments/:paymentId/result'],
  sources: ['services/commerce/src/modules/checkout/application/handler/ConfirmQuoteHandler.ts', 'services/commerce/src/modules/payment/application/ReadPayment.ts'],
  markers: [/payment\.prepare/, /payment\.capture/, /action/],
});
