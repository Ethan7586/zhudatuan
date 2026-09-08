import type { OperationId } from '@shop/contract';
import type { DomainEvent } from '@shop/kernel';
import type { OperationSecurityContext } from '../platform/security/OperationSecurityContext';
import type { ReadTransactionContext, WriteTransactionContext } from '../platform/database/TransactionContext';

export interface ExecutionContext<TKey extends OperationId = OperationId> {
  readonly requestId: string;
  readonly traceId: string;
  readonly deadline: number;
  readonly signal: AbortSignal;
  readonly operation: TKey;
  readonly security: OperationSecurityContext;
  readonly headers: Readonly<Record<string, string>>;
  readonly rawBody: string;
  readonly publicActor?: string;
  readonly idempotencyKey?: string;
  readonly expectedVersion?: number;
  readonly actionProof?: string;
}

export interface HandlerContext<TKey extends OperationId = OperationId> extends ExecutionContext<TKey> {
  readonly transaction: ReadTransactionContext;
}

export interface WriteHandlerContext<TKey extends OperationId = OperationId> extends ExecutionContext<TKey> {
  readonly transaction: WriteTransactionContext;
}

export type PrepareContext<TKey extends OperationId = OperationId> = ExecutionContext<TKey>;
export type CommitContext<TKey extends OperationId = OperationId> = WriteHandlerContext<TKey>;

export interface FinalizeContext<TKey extends OperationId = OperationId> extends ExecutionContext<TKey> {
  readonly emit: (event: DomainEvent) => Promise<void>;
}
