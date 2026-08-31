import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront order journey', {
  operations: ['order.orders.read', 'fulfillment.tracking.read', 'order.reminders.create', 'order.orders.receive'],
  routes: ['/orders', '/orders/:orderId'],
  sources: ['services/commerce/src/modules/order/OrderOperations.ts', 'apps/storefront/src/feature/order/application/ReadOrder.ts'],
  markers: [/expectedVersion|expected_version/, /Promise\.all/, /tracking/],
});
