import { journey } from './JourneyHarness';
journey('MVP05', { workstation: 'groupdashboard', operations: ['reporting.dashboard.read'], tables: ['reporting.metric', 'reporting.fact', 'reporting.orderprojection'], event: 'order.paid' });
