import type { OperationExecutor, RequestContext } from '@shop/sdk';

export interface AuthorizedRuntime {
  authorizedRead<T>(run: (executor: OperationExecutor, context: RequestContext) => Promise<T>, options?: Readonly<{ signal?: AbortSignal; includeScope?: boolean }>): Promise<T>;
  authorizedWrite<T>(
    run: (executor: OperationExecutor, context: RequestContext) => Promise<T>,
    options: Readonly<{ idempotencyKey: string; signal?: AbortSignal; expectedVersion?: number; includeScope?: boolean }>
  ): Promise<T>;
}
