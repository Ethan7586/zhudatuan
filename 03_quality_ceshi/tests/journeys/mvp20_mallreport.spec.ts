import { journey } from './JourneyHarness';
journey('MVP20', { workstation: 'mallreport', operations: ['reporting.sales.read', 'reporting.products.read', 'reporting.categories.read', 'reporting.channels.read', 'reporting.powderclass.read', 'reporting.voucherconsumption.read'], tables: ['reporting.metric', 'reporting.fact', 'reporting.export'], event: 'order.paid' });
