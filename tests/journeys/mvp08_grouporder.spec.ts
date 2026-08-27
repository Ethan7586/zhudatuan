import { journey } from './JourneyHarness';
journey('MVP08', { workstation: 'grouporder', operations: ['order.orders.read', 'order.aftersales.read', 'order.aftersales.approve', 'fulfillment.returns.inspect', 'payment.refunds.request'], tables: ['ordering.orderrecord', 'ordering.aftersale', 'payment.refund'], event: 'payment.refunded' });
