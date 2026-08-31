import { journey } from './JourneyHarness';
journey('MVPGROUPDASHBOARD', { workstation: 'groupdashboard', operations: ['reporting.dashboard.read'], tables: ['reporting.metric', 'reporting.fact', 'reporting.orderprojection'], event: 'order.paid' });
