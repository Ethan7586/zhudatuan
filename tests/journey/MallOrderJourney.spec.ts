import { journey } from './JourneyHarness';
journey('MVPMALLORDER', {
  workstation: 'mallorder',
  operations: ['order.orders.read', 'order.aftersales.read', 'order.aftersales.approve', 'fulfillment.shipments.create', 'payment.refunds.request'],
  tables: ['ordering.orderrecord', 'ordering.aftersale', 'fulfillment.fulfillmentorder'],
  event: 'fulfillment.shipped',
});
