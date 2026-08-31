import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront guest journey', {
  operations: ['storefront.bootstrap.read', 'storefront.catalog.read'],
  routes: ['/', '/products', '/products/:productId'],
  sources: ['services/commerce/src/app/storefront/BootstrapQuery.ts', 'services/commerce/src/app/storefront/CatalogQuery.ts'],
  markers: [/canonicalHost/, /cache-control/, /allParallel/],
});
