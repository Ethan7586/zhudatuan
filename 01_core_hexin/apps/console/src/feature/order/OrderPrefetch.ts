import type { QueryClient } from '@tanstack/react-query';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { orderKey, readOrders, type OrderQuery } from './OrderQuery';

export const ORDER_PREFETCH_STALE_TIME_MS = 30_000;

const defaultOrderQuery: OrderQuery = Object.freeze({
  order: '', placed: '', lifecycle: '', payment: '', fulfillment: '', mall: '', view: 'all',
});

export function prefetchOrders(queryClient: QueryClient, context: ConsoleContext): Promise<void> | undefined {
  if (!context.session.capabilities.includes('order.orders.read')) return undefined;
  const queryKey = orderKey(context, defaultOrderQuery);
  const state = queryClient.getQueryState(queryKey);
  if (state?.data !== undefined || state?.fetchStatus === 'fetching' || state?.status === 'error') return undefined;
  return queryClient.prefetchQuery({
    queryKey,
    queryFn: ({ signal }) => readOrders(context, defaultOrderQuery, signal),
    staleTime: ORDER_PREFETCH_STALE_TIME_MS,
    retry: false,
  });
}
