import { OP_FINANCE_OVERVIEW_READ } from '@shop/contract/ids';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import type { FinanceReconciliationQuery } from '../model/Finance';
import { financeSectionOperation } from '../model/FinanceOperation';
import { financeOverviewKey, financeReconciliationKey, financeSectionKey } from './FinanceQueryKey';
import { financeNavigation, type FinancePage, type FinancePrimaryPage } from './NavigationViewModel';

const defaultReconciliationQuery: FinanceReconciliationQuery = Object.freeze({ limit: 50 });

export function useFinancePrefetch(context: ConsoleContext, dependencies: FinanceDependencies, active: FinancePage, ready: boolean) {
  const client = useQueryClient();
  useEffect(() => {
    if (!ready) return;
    adjacentPages(active).forEach((page) => {
      if (!canPrefetch(context, page)) return;
      void prefetch(client, context, dependencies, page).catch(() => undefined);
    });
  }, [active, client, context, dependencies, ready]);
}

function adjacentPages(active: FinancePage): readonly FinancePrimaryPage[] {
  const index = financeNavigation.findIndex(({ key }) => key === active);
  if (index < 0) return [];
  return [financeNavigation[index - 1]?.key, financeNavigation[index + 1]?.key].filter((page): page is FinancePrimaryPage => page !== undefined);
}

function canPrefetch(context: ConsoleContext, page: FinancePrimaryPage): boolean {
  const operation = page === 'overview' ? OP_FINANCE_OVERVIEW_READ : financeSectionOperation(page);
  return canUseOperation(context, operation) && context.session.assurance.level >= requiredAssurance(operation);
}

function prefetch(client: QueryClient, context: ConsoleContext, dependencies: FinanceDependencies, page: FinancePrimaryPage): Promise<void> {
  if (page === 'overview') {
    return client.prefetchQuery({ queryKey: financeOverviewKey(context), queryFn: ({ signal }) => dependencies.readOverview.execute(context, signal), staleTime: 30_000 });
  }
  if (page === 'reconciliations') {
    return client.prefetchQuery({ queryKey: financeReconciliationKey(context, defaultReconciliationQuery), queryFn: ({ signal }) => dependencies.readReconciliations.execute(context, defaultReconciliationQuery, signal), staleTime: 30_000 });
  }
  return client.prefetchQuery({ queryKey: financeSectionKey(context, page), queryFn: ({ signal }) => dependencies.readSection.execute(context, page, undefined, signal), staleTime: 30_000 });
}
