import { journey } from './JourneyHarness';
journey('MVP10', { workstation: 'groupfinance', operations: ['finance.overview.read', 'finance.entries.read', 'finance.statements.read',
  'finance.reconciliations.read', 'finance.reconciliations.manage', 'finance.settlements.read', 'finance.settlements.decide',
  'finance.withdrawals.read', 'finance.withdrawals.create', 'finance.withdrawals.decide', 'finance.periods.read', 'finance.periods.manage',
  'invoice.requests.create', 'invoice.requests.decide', 'invoice.requests.red'],
tables: ['finance.journal', 'finance.entry', 'finance.reconciliationitem', 'finance.settlement', 'finance.withdrawal', 'finance.periodclose', 'invoice.request'],
event: 'finance.entry.posted' });
