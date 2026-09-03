import { journey } from './JourneyHarness';
journey('MVPMALLREPORT', {
  workstation: 'mallreport',
  operations: ['reporting.sales.read', 'reporting.products.read', 'reporting.malls.read', 'reporting.categories.read', 'reporting.channels.read', 'reporting.voucherconsumption.read'],
  tables: ['reporting.metric', 'reporting.fact', 'reporting.export'],
  event: 'order.paid',
});
