import { useNavigate } from 'react-router';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import type { RouteId } from '../../../generated/RouteBinding';
import type { FinanceSection } from '../model/Finance';

export type FinancePage = 'overview' | FinanceSection;
const financeNavigation = Object.freeze([
  { key: 'overview', label: '财务总览', route: 'consolefinance' },
  { key: 'entries', label: '账本分录', route: 'consolefinanceentry' },
  { key: 'statements', label: '账单', route: 'consolefinancestatement' },
  { key: 'reconciliations', label: '对账', route: 'consolefinancereconciliation' },
  { key: 'settlements', label: '结算单', route: 'consolefinancesettlement' },
  { key: 'withdrawals', label: '提现', route: 'consolefinancewithdrawal' },
  { key: 'invoices', label: '发票', route: 'consolefinanceinvoice' },
] satisfies readonly Readonly<{ key: FinancePage; label: string; route: RouteId }>[]);

export function useFinanceNavigationViewModel(context: ConsoleContext, active: FinancePage) {
  const navigate = useNavigate();
  return Object.freeze({
    active,
    items: financeNavigation,
    select: (route: (typeof financeNavigation)[number]['route']) => {
      void navigate(scopeRoutePath(context.scope, route));
    },
  });
}

export type FinanceNavigationViewModel = ReturnType<typeof useFinanceNavigationViewModel>;
