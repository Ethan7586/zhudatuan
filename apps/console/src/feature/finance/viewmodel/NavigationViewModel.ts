import { useNavigate } from 'react-router';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { scopePath } from '../../../shared/url/ScopePath';
import { financeSections, type FinanceSection } from '../model/Finance';

export type FinancePage = 'overview' | FinanceSection;

export function useFinanceNavigationViewModel(context: ConsoleContext, active: FinancePage) {
  const navigate = useNavigate();
  return Object.freeze({
    active,
    items: financeSections,
    select: (suffix: string) => { void navigate(scopePath(context.scope, suffix)); },
  });
}

export type FinanceNavigationViewModel = ReturnType<typeof useFinanceNavigationViewModel>;
