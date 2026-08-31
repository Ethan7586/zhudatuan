import { journey } from './JourneyHarness';
journey('MVPGROUPSUPPORT', {
  workstation: 'groupsupport',
  operations: ['support.cases.read', 'support.cases.update', 'support.messages.send', 'support.assignments.manage'],
  tables: ['support.case', 'support.message', 'support.assignment'],
  event: 'support.message.sent',
});
