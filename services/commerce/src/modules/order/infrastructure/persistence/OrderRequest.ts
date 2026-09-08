import type { OperationId, OperationInputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationRequest } from '../../../../pipeline/OperationRequest';

export function emptyOrderFacets() {
  return Object.freeze({
    state: 'ready' as const,
    data: Object.freeze({
      counts: Object.freeze({ all: 0, unpaid: 0, unshipped: 0, active: 0, completed: 0, aftersale: 0, exception: 0 }),
      watermarks: Object.freeze({ order: null, payment: null, fulfillment: null, aftersale: null, refund: null }),
    }),
  });
}

export function iso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}
export function orderRequest<TKey extends OperationId>(type: TKey, input: OperationInputFor<TKey>, execution: ExecutionContext<TKey>): OperationRequest {
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
