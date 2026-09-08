import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext, WriteHandlerContext } from './HandlerContext';
import type { TransactionMode } from '../platform/database/TransactionContext';
import type { DomainEvent } from '@shop/kernel';
export type { OperationInput, OperationRequest, OperationResult } from './OperationRequest';

export interface OperationReply<TOutput> {
  readonly status: number;
  readonly body: TOutput;
  readonly headers?: Readonly<Record<string, string>>;
  readonly events?: readonly DomainEvent[];
}

export interface OperationHandler<TKey extends OperationId = OperationId, TMode extends TransactionMode = TransactionMode> {
  readonly operation: TKey;
  readonly mode: TMode;
  execute(input: OperationInputFor<TKey>, context: TMode extends 'write' ? WriteHandlerContext<TKey> : HandlerContext<TKey>): Promise<OperationReply<OperationOutputFor<TKey>>>;
}

export interface DurableCommit<TCheckpoint, TOutput> {
  readonly checkpoint: TCheckpoint;
  readonly response: OperationReply<TOutput>;
  readonly events?: readonly DomainEvent[];
}

export interface DurableOperationHandler<TKey extends OperationId = OperationId, TPrepared = unknown, TCheckpoint = unknown, TMode extends TransactionMode = TransactionMode, TLoaded = undefined> {
  readonly operation: TKey;
  readonly mode: TMode;
  load?(input: OperationInputFor<TKey>, context: HandlerContext<TKey>): Promise<TLoaded>;
  prepare(input: OperationInputFor<TKey>, context: PrepareContext<TKey>, loaded: TLoaded): Promise<TPrepared>;
  transactionScope?(input: OperationInputFor<TKey>, prepared: TPrepared, context: PrepareContext<TKey>): string | undefined;
  commit(input: OperationInputFor<TKey>, prepared: TPrepared, context: TMode extends 'write' ? CommitContext<TKey> : HandlerContext<TKey>): Promise<DurableCommit<TCheckpoint, OperationOutputFor<TKey>>>;
  finalize(input: OperationInputFor<TKey>, checkpoint: TCheckpoint, context: FinalizeContext<TKey>): Promise<OperationReply<OperationOutputFor<TKey>>>;
  idempotencyResponse?(response: OperationReply<OperationOutputFor<TKey>>): OperationReply<OperationOutputFor<TKey>>;
  discard?(prepared: TPrepared, cause: unknown): Promise<void>;
}

export type RegisteredOperationHandler<TKey extends OperationId = OperationId> = OperationHandler<TKey, TransactionMode> | DurableOperationHandler<TKey, unknown, unknown, TransactionMode, unknown>;
