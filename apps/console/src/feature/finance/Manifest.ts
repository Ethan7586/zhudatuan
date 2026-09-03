import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const FinanceManifest = defineComponent({
  component: 'finance',
  navigationids: ['groupfinance', 'mallfinance'],
  load: () => import('./route/FinanceRoute'),
  routes: [
    { routeid: 'consolefinance' },
    { routeid: 'consolefinanceentry', load: () => import('./route/EntryRoute') },
    { routeid: 'consolefinancestatement', load: () => import('./route/StatementRoute') },
    { routeid: 'consolefinancereconciliation', load: () => import('./route/ReconciliationRoute') },
    { routeid: 'consolefinancesettlement', load: () => import('./route/SettlementRoute') },
    { routeid: 'consolefinancewithdrawal', load: () => import('./route/WithdrawalRoute') },
    { routeid: 'consolefinanceinvoice', load: () => import('./route/InvoiceRoute') },
  ],
});
