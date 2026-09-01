import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationRequest';

export interface PreparedIdentityLifecycle<T> {
  readonly request: OperationRequest;
  readonly preparation: T;
}

export interface IdentityLifecycleCheckpoint<T> {
  readonly request: OperationRequest;
  readonly result: OperationResult;
  readonly preparation: T;
}

export function identityRequest<TKey extends OperationId>(operation: TKey, input: OperationInputFor<TKey>, context: PrepareContext<TKey>): OperationRequest {
  const wire = input as Readonly<{ path?: Readonly<Record<string, string>>; query?: Readonly<Record<string, string | readonly string[]>>; body?: unknown }>;
  return Object.freeze({
    type: operation,
    input: Object.freeze({
      path: wire.path ?? {},
      query: wire.query ?? {},
      body: wire.body,
      headers: context.headers,
      rawBody: context.rawBody,
      deadline: context.deadline,
      signal: context.signal,
      ...(context.publicActor === undefined ? {} : { publicActor: context.publicActor }),
      ...(context.idempotencyKey === undefined ? {} : { idempotency: context.idempotencyKey }),
      ...(context.expectedVersion === undefined ? {} : { expectedVersion: context.expectedVersion }),
    }),
    security: context.security,
  });
}

export function identityReply<TKey extends OperationId>(result: OperationResult): OperationReply<OperationOutputFor<TKey>> {
  return Object.freeze({
    status: result.status,
    body: result.body as OperationOutputFor<TKey>,
    ...(result.headers === undefined ? {} : { headers: result.headers }),
  });
}
