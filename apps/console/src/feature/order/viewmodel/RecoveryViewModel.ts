import { presentError } from '@shop/presentation';
import type { OrderRecoveryPage, OrderRecoveryState } from '../model/Order';

export function orderRecoveryState(
  allowed: boolean,
  query: Readonly<{ isPending: boolean; isError: boolean; error: unknown; data: OrderRecoveryPage | undefined }>
): OrderRecoveryState {
  if (!allowed) return Object.freeze({ state: 'hidden' });
  if (query.isPending) return Object.freeze({ state: 'loading' });
  if (query.isError) {
    const failure = presentError(query.error);
    return Object.freeze({ state: 'unavailable', error: Object.freeze({ message: failure.message, retryable: failure.retryable, ...(failure.requestId === undefined ? {} : { traceId: failure.requestId }) }) });
  }
  return Object.freeze({ state: 'ready', data: query.data ?? Object.freeze({ items: Object.freeze([]), count: 0 }) });
}
