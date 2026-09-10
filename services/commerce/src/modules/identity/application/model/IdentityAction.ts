import type { OperationRequest, OperationResult } from '../../../../pipeline/OperationRequest';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { ReadTransactionContext, TransactionMode, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

type IdentityTransaction<TMode extends TransactionMode> = TMode extends 'write' ? WriteTransactionContext : ReadTransactionContext;

export type IdentityAction<TMode extends TransactionMode = 'write'> = (request: OperationRequest, context: IdentityTransaction<TMode>) => Promise<OperationResult>;

export type IdentityStatelessAction<TKey extends import('@shop/contract').OperationId> = (request: OperationRequest, context: ExecutionContext<TKey>) => Promise<OperationResult>;

export interface IdentityLifecycle<TPreparation = unknown, TLoaded = undefined, TMode extends TransactionMode = 'write'> {
  load?(request: OperationRequest, context: ReadTransactionContext): Promise<TLoaded>;
  prepare?(request: OperationRequest, loaded: TLoaded): Promise<TPreparation>;
  shortCircuit?(request: OperationRequest, preparation: TPreparation): OperationResult | undefined;
  execute(request: OperationRequest, context: IdentityTransaction<TMode>, preparation: TPreparation): Promise<OperationResult>;
  finalize?(request: OperationRequest, result: OperationResult, preparation: TPreparation): Promise<OperationResult>;
  discard?(request: OperationRequest, preparation: TPreparation, cause: unknown): Promise<void>;
}

export function identityLifecycle<TPreparation, TLoaded = undefined, TMode extends TransactionMode = 'write'>(definition: IdentityLifecycle<TPreparation, TLoaded, TMode>): IdentityLifecycle<TPreparation, TLoaded, TMode> {
  return definition;
}
