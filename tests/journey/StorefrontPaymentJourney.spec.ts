import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront payment journey', {
  operations: ['order.orders.create', 'payment.intents.read'],
  routes: ['/checkout', '/payments/:paymentId/result'],
  sources: ['services/commerce/src/modules/checkout/infrastructure/persistence/CheckoutConfirmationService.ts', 'services/commerce/src/modules/payment/infrastructure/persistence/PaymentReader.ts'],
  markers: [/payment\.prepare/, /payment\.capture/, /action/],
});
