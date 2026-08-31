import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { OperationContext } from './OperationContext';
export type { OperationInput, OperationRequest, OperationResult, OperationUsecase } from './OperationExecution';

export interface TypedOperationUsecase<TKey extends OperationId> {
  execute(input: OperationInputFor<TKey>, context: OperationContext): Promise<OperationReply<OperationOutputFor<TKey>>>;
}

export interface OperationReply<TOutput> {
  readonly status: number;
  readonly body: TOutput;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface TypedOperationHandler<TKey extends OperationId = OperationId> {
  readonly operation: TKey;
  handle(input: OperationInputFor<TKey>, context: OperationContext): Promise<OperationReply<OperationOutputFor<TKey>>>;
}

export interface OperationHandlerType<TKey extends OperationId> {
  new (usecase: TypedOperationUsecase<TKey>): TypedOperationHandler<TKey>;
  readonly operation: TKey;
}

export function defineOperationHandler<const TKey extends OperationId>(operation: TKey): OperationHandlerType<TKey> {
  class BoundOperationHandler implements TypedOperationHandler<TKey> {
    static readonly operation = operation;
    readonly operation = operation;

    constructor(private readonly usecase: TypedOperationUsecase<TKey>) {}

    handle(input: OperationInputFor<TKey>, context: OperationContext): Promise<OperationReply<OperationOutputFor<TKey>>> {
      return this.usecase.execute(input, context);
    }
  }
  return BoundOperationHandler;
}
