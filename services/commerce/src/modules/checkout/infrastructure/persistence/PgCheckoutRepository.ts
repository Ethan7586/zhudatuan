import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { OperationId, OperationInputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationRequest } from '../../../../pipeline/OperationHandler';
import type { CheckoutRepository } from '../../application/port/CheckoutRepository';
import type { ConfirmCheckout } from '../../application/service/ConfirmCheckout';
export class PgCheckoutRepository implements CheckoutRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly confirmation: ConfirmCheckout
  ) {}
  confirm(context: WriteTransactionContext, input: OperationInputFor<'order.orders.create'>, execution: ExecutionContext<'order.orders.create'>) {
    return this.confirmation.execute(checkoutRequest('order.orders.create', input, execution), context) as never;
  }
}
export function checkoutRequest<TKey extends OperationId>(type: TKey, input: OperationInputFor<TKey>, execution: ExecutionContext<TKey>): OperationRequest {
  const wire = input as Readonly<{
    path?: Readonly<Record<string, string>>;
    query?: Readonly<Record<string, string | readonly string[]>>;
    body?: unknown;
  }>;
  return {
    type,
    input: {
      path: wire.path ?? {},
      query: wire.query ?? {},
      headers: execution.headers,
      body: wire.body,
      rawBody: execution.rawBody,
      deadline: execution.deadline,
      signal: execution.signal,
      ...(execution.publicActor === undefined ? {} : { publicActor: execution.publicActor }),
      ...(execution.idempotencyKey === undefined ? {} : { idempotency: execution.idempotencyKey }),
      ...(execution.expectedVersion === undefined ? {} : { expectedVersion: execution.expectedVersion }),
    },
    security: execution.security,
  };
}
