import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const FinanceManifest = defineComponent({
  component: 'finance',
  navigationids: ['groupfinance', 'mallfinance'],
  load: () => import('./FinanceRoute'),
  routes: [
    { route: 'finance' },
    { route: 'finance/entries', load: () => import('./EntryRoute') },
    { route: 'finance/statements', load: () => import('./StatementRoute') },
    { route: 'finance/reconciliations', load: () => import('./ReconciliationRoute') },
    { route: 'finance/settlements', load: () => import('./SettlementRoute') },
    { route: 'finance/withdrawals', load: () => import('./WithdrawalRoute') },
    { route: 'finance/invoices', load: () => import('./InvoiceRoute') },
  ],
});
