import { journey } from './JourneyHarness';
journey('MVPMALLDASHBOARD', { workstation: 'malldashboard', operations: ['reporting.dashboard.read'], tables: ['reporting.metric', 'reporting.fact', 'reporting.orderprojection'], event: 'order.paid' });
