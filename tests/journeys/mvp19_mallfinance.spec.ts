import { journey } from './JourneyHarness';
journey('MVP19', { workstation: 'mallfinance', operations: ['finance.overview.read', 'finance.entries.read', 'finance.statements.read',
  'finance.reconciliations.read', 'finance.periods.read', 'finance.periods.manage', 'finance.policies.manage',
  'invoice.profiles.manage', 'invoice.requests.create', 'invoice.requests.read'],
tables: ['finance.account', 'finance.journal', 'finance.entry', 'finance.statement', 'finance.periodclose', 'invoice.request'],
event: 'finance.entry.posted' });
