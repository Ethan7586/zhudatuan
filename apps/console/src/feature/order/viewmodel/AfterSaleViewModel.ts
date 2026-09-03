import { safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import type { OrderDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { AfterSaleQuery } from '../model/AfterSale';
import { aftersaleKey } from './OrderQueryKey';

export function useAfterSaleViewModel(context: ConsoleContext, dependencies: OrderDependencies, filter: AfterSaleQuery, enabled: boolean) {
  const query = useQuery({ queryKey: aftersaleKey(context, filter), queryFn: ({ signal }) => dependencies.readAftersales.execute(context, filter, signal), enabled });
  return Object.freeze({
    data: query.data,
    pending: query.isPending,
    fetching: query.isFetching,
    failed: query.isError,
    error: safeQueryError(query.error),
    retry: () => void query.refetch(),
  });
}

export type AfterSaleViewModel = ReturnType<typeof useAfterSaleViewModel>;
