import { queryCondition, safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { OrderDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { orderDetailKey } from './OrderQueryKey';

export function useOrderDetailViewModel(context: ConsoleContext, dependencies: OrderDependencies, reference?: string) {
  const [copied, setCopied] = useState(false);
  const query = useQuery({
    queryKey: orderDetailKey(context, reference ?? ''),
    queryFn: ({ signal }) => (reference === undefined ? Promise.resolve(undefined) : dependencies.readDetail.execute(context, reference, signal)),
    enabled: reference !== undefined && reference !== '',
  });
  const copyNumber = () => {
    if (query.data === undefined || navigator.clipboard === undefined) return;
    void navigator.clipboard
      .writeText(query.data.order_number)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => setCopied(false));
  };
  const condition = queryCondition({
    pending: query.isPending,
    fetching: query.isFetching,
    error: query.error,
    hasData: query.data !== undefined,
    empty: query.data === undefined && !query.isPending && query.error === null,
  });
  return Object.freeze({
    reference,
    data: query.data,
    pending: query.isPending,
    fetching: query.isFetching,
    failed: query.isError,
    error: safeQueryError(query.error),
    condition,
    copied,
    copyNumber,
    refresh: () => void query.refetch(),
  });
}

export type DetailViewModel = ReturnType<typeof useOrderDetailViewModel>;
