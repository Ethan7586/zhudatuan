import type { ApiErrorCode, HttpMethod, OperationAudience, OperationTarget, OperationId, OperationInputFor, OperationOutputFor, OperationResponseMode, Schema } from '@shop/contract';
import type { RequestContext } from './RequestContext';
import type { EventStream } from './EventStream';

export interface OperationDescriptor<TKey extends OperationId> {
  readonly id: TKey;
  readonly method: HttpMethod;
  readonly path: `/api/v1/${string}` | `/health/${string}`;
  readonly audience: OperationAudience;
  readonly targets: readonly OperationTarget[];
  readonly responseMode: OperationResponseMode;
  readonly idempotent: boolean;
  readonly timeout: number;
  readonly errorUnion: readonly ApiErrorCode[];
  readonly input: Schema<OperationInputFor<TKey>>;
  readonly output: Schema<OperationOutputFor<TKey>>;
}

export interface OperationExecutor {
  execute<TKey extends OperationId>(operation: OperationDescriptor<TKey>, input: OperationInputFor<TKey>, context: RequestContext): Promise<OperationOutputFor<TKey>>;
  stream<TKey extends OperationId>(operation: OperationDescriptor<TKey>, input: OperationInputFor<TKey>, context: RequestContext): EventStream<OperationOutputFor<TKey>>;
}

export type OperationMethod<TKey extends OperationId> = (input: OperationInputFor<TKey>, context: RequestContext) => Promise<OperationOutputFor<TKey>>;
export type EventOperationMethod<TKey extends OperationId> = (input: OperationInputFor<TKey>, context: RequestContext) => EventStream<OperationOutputFor<TKey>>;

export function bindOperation<TKey extends OperationId>(client: OperationExecutor, operation: OperationDescriptor<TKey>): OperationMethod<TKey> {
  return (input, context) => client.execute(operation, input, context);
}

export function bindEventOperation<TKey extends OperationId>(client: OperationExecutor, operation: OperationDescriptor<TKey>): EventOperationMethod<TKey> {
  if (operation.responseMode !== 'stream') throw new Error('SDK_OPERATION_NOT_STREAM');
  return (input, context) => client.stream(operation, input, context);
}
