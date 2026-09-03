import { queryCondition, safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { FinanceSection } from '../model/Finance';
import { financeSectionKey } from './FinanceQueryKey';
import { useFinanceNavigationViewModel } from './NavigationViewModel';

export function useSectionViewModel(context: ConsoleContext, dependencies: FinanceDependencies, section: FinanceSection) {
  const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
  const scope = `${context.scope.kind}:${context.scope.id}`;
  const previousScope = useRef(scope);
  const query = useQuery({ queryKey: financeSectionKey(context, section, cursor), queryFn: ({ signal }) => dependencies.readSection.execute(context, section, cursor, signal) });
  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    setSearch((current) => { const next = new URLSearchParams(current); next.delete('cursor'); return next; }, { replace: true });
  }, [scope, setSearch]);
  const data = query.data;
  return Object.freeze({
    section,
    navigation: useFinanceNavigationViewModel(context, section),
    data,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: data?.items.length === 0 }),
    error: safeQueryError(query.error),
    refresh: () => { void query.refetch(); },
    next: (nextCursor: string) => setSearch((current) => { const next = new URLSearchParams(current); next.set('cursor', nextCursor); return next; }),
  });
}

export type SectionViewModel = ReturnType<typeof useSectionViewModel>;
