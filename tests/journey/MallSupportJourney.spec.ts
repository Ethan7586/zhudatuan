import { journey } from './JourneyHarness';
journey('MVPMALLSUPPORT', {
  workstation: 'mallsupport',
  operations: ['support.cases.read', 'support.assignments.manage', 'support.messages.send', 'support.history.read'],
  tables: ['support.case', 'support.message', 'support.sla'],
  event: 'support.sla.escalated',
});
