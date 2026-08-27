import { journey } from './JourneyHarness';
journey('MVP14', { workstation: 'malldashboard', operations: ['reporting.dashboard.read'], tables: ['reporting.metric', 'reporting.fact', 'reporting.orderprojection'], event: 'order.paid' });
