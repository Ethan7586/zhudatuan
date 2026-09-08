import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront provider fulfillment journey', {
  operations: ['storefront.catalog.read', 'channel.operations.read', 'extension.installations.read', 'fulfillment.tracking.read'],
  routes: ['/products', '/orders/:orderId'],
  sources: ['services/commerce/src/composition/ProviderRuntime.ts', 'services/commerce/src/composition/ExtensionRegistry.ts', 'services/commerce/src/modules/fulfillment/infrastructure/persistence/PgFulfillmentJobProcess.ts'],
  markers: [/shopprovider/, /CAS_FAILED/, /provider/],
});
