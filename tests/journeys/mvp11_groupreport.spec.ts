import { journey } from './JourneyHarness';
journey('MVP11', { workstation: 'groupreport', operations: ['reporting.sales.read', 'reporting.products.read', 'reporting.channels.read', 'reporting.powderclass.read', 'reporting.voucherconsumption.read'], tables: ['reporting.metric', 'reporting.fact', 'reporting.export'], event: 'order.paid' });
