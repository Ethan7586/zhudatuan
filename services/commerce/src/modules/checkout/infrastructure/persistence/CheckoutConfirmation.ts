import type { OperationInputFor } from '@shop/contract';
import type { FinalizeContext } from '../../../../foundation/application/HandlerContext';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';

export function checkoutOperationRequest(input: OperationInputFor<'order.orders.create'>, context: FinalizeContext<'order.orders.create'>): OperationRequest {
  return {
    type: 'order.orders.create',
    input: {
      path: input.path ?? {},
      query: Object.fromEntries(Object.entries(input.query ?? {}).filter((entry) => entry[1] !== undefined)) as Readonly<Record<string, string | readonly string[]>>,
      headers: context.headers,
      body: input.body,
      rawBody: context.rawBody,
      deadline: context.deadline,
      signal: context.signal,
      ...(context.publicActor === undefined ? {} : { publicActor: context.publicActor }),
      ...(context.idempotencyKey === undefined ? {} : { idempotency: context.idempotencyKey }),
      ...(context.expectedVersion === undefined ? {} : { expectedVersion: context.expectedVersion }),
    },
    security: context.security,
  };
}
