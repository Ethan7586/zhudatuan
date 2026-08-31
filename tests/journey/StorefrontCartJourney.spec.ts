import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront cart journey', {
  operations: ['cart.current.read', 'cart.items.put', 'cart.items.batch', 'checkout.quote.create'],
  routes: ['/cart', '/checkout'],
  sources: ['services/commerce/src/modules/cart/application/command/PutCartItem.ts', 'services/commerce/src/modules/checkout/application/command/CreateQuote.ts'],
  markers: [/expectedVersion/, /lineVersion/, /cartConflict|listingUnavailable/],
});
