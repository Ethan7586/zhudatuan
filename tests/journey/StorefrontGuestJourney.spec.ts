import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront guest journey', {
  operations: ['storefront.bootstrap.read', 'storefront.catalog.read'],
  routes: ['/', '/products', '/products/:productId'],
  sources: ['services/commerce/src/modules/navigation/application/service/BootstrapQuery.ts', 'services/commerce/src/modules/navigation/application/service/CatalogQuery.ts'],
  markers: [/canonicalHost/, /cache-control/, /allParallel/],
});
