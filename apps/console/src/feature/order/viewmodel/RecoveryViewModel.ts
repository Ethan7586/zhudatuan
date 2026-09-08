import { OP_PAYMENT_RECOVERIES_READ } from '@shop/contract/ids';
import { presentError } from '@shop/presentation';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import type { OrderRecoveryPage, OrderRecoveryState } from '../model/Order';

export interface OrderRecoveryAccess {
  readonly allowed: boolean;
  readonly ready: boolean;
}

export function orderRecoveryAccess(context: ConsoleContext): OrderRecoveryAccess {
  const allowed = canUseOperation(context, OP_PAYMENT_RECOVERIES_READ);
  return Object.freeze({ allowed, ready: allowed && context.session.assurance.level >= requiredAssurance(OP_PAYMENT_RECOVERIES_READ) });
}

export function orderRecoveryState(access: OrderRecoveryAccess, query: Readonly<{ isPending: boolean; isError: boolean; error: unknown; data: OrderRecoveryPage | undefined }>): OrderRecoveryState {
  if (!access.allowed) return Object.freeze({ state: 'hidden' });
  if (!access.ready) return Object.freeze({ state: 'locked' });
  if (query.isPending) return Object.freeze({ state: 'loading' });
  if (query.isError) {
    const failure = presentError(query.error);
    return Object.freeze({ state: 'unavailable', error: Object.freeze({ message: failure.message, retryable: failure.retryable, ...(failure.requestId === undefined ? {} : { traceId: failure.requestId }) }) });
  }
  return Object.freeze({ state: 'ready', data: query.data ?? Object.freeze({ items: Object.freeze([]), count: 0 }) });
}
