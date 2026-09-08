import { storefrontJourney } from './StorefrontJourneyHarness';

storefrontJourney('storefront product-to-payment journey', {
  operations: ['storefront.catalog.read', 'cart.items.put', 'checkout.quote.create', 'order.orders.create', 'payment.intents.read'],
  routes: ['/products/:productId', '/cart', '/checkout', '/payments/:paymentId/result'],
  sources: [
    'apps/storefront/src/StorefrontJourney.test.ts',
    'services/commerce/src/modules/checkout/application/service/ConfirmCheckout.ts',
    'services/commerce/src/modules/payment/infrastructure/persistence/PaymentReader.ts',
  ],
  markers: [/listingId/, /confirmationToken/, /payment/],
});
