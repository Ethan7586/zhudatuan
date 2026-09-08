import { permissionDefinition } from '@shop/authz';
import { isConsumerTarget, OperationCatalog, type OperationId, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import { Redactor } from '@shop/telemetry';
import type { DomainEvent } from '@shop/kernel';
import { DomainError } from '../platform/error/DomainError';
import type { WriteTransactionContext } from '../platform/database/TransactionContext';
import type { TransactionManager, TransactionOptions } from '../platform/database/TransactionManager';
import { sessionAccess } from '../platform/security/OperationSecurityContext';
import { authorizationEvidence } from '../platform/security/AuthorizationEvidence';
import type { AuditDecorator } from './AuditDecorator';
import type { ExecutionContext, FinalizeContext, HandlerContext } from './HandlerContext';
import type { IdempotencyClaim, IdempotencyRepository } from './IdempotencyRepository';
import { executionRequestHash } from './OperationHash';
import type { DurableOperationHandler, OperationHandler, OperationReply, RegisteredOperationHandler } from './OperationHandler';

import { appendEvents, assertHandlerMode, executionIdentity, idempotencyClaim, idempotencyResponse, makerCheckerInput, requiresIdempotency, resourceOf, transactionOptions, transactionScope } from './OperationContext';
export interface MakerCheckerGuard {
  verify(
    context: WriteTransactionContext,
    input: Readonly<{
      operation: OperationId;
      requestHash: string;
      resource: string;
      expectedVersion?: number;
      actionProof?: string;
      execution: ExecutionContext;
    }>
  ): Promise<void>;
}

export interface TransactionalEventWriter {
  append(context: WriteTransactionContext, event: DomainEvent): Promise<void>;
  appendMany?(context: WriteTransactionContext, events: readonly DomainEvent[]): Promise<void>;
}

export class OperationExecutor {
  private readonly redactor = new Redactor();

  constructor(
    private readonly transactions: TransactionManager,
    private readonly idempotency: IdempotencyRepository,
    private readonly makerChecker: MakerCheckerGuard,
    private readonly audit: AuditDecorator,
    private readonly outbox: TransactionalEventWriter
  ) {}

  execute<TKey extends OperationId>(handler: RegisteredOperationHandler<TKey>, input: OperationInputFor<TKey>, execution: ExecutionContext<TKey>): Promise<OperationReply<OperationOutputFor<TKey>>> {
    if (handler.operation !== execution.operation) throw new Error(`HANDLER_OPERATION_MISMATCH:${execution.operation}`);
    if ('prepare' in handler) return this.durable(handler, input, execution);
    return this.standard(handler, input, execution);
  }

  private standard<TKey extends OperationId>(handler: OperationHandler<TKey, 'read' | 'write'>, input: OperationInputFor<TKey>, execution: ExecutionContext<TKey>): Promise<OperationReply<OperationOutputFor<TKey>>> {
    const operation = OperationCatalog.get(handler.operation);
    assertHandlerMode(operation.method, handler);
    const auditedRead = operation.method === 'GET' && operation.permission !== null && ['high', 'critical'].includes(permissionDefinition(operation.permission).risk);
    if (handler.mode === 'read' && !auditedRead) {
      return this.transactions.read(transactionOptions(execution, undefined, handler.isolation), (transaction) => (handler as OperationHandler<TKey, 'read'>).execute(input, Object.freeze({ ...execution, transaction }) as HandlerContext<TKey>));
    }
    return this.transactions.write(transactionOptions(execution, undefined, handler.isolation), async (transaction) => {
      const claim = requiresIdempotency(operation) ? idempotencyClaim(execution, input) : undefined;
      if (claim) {
        const state = await this.idempotency.claim(transaction, claim);
        if (state.state !== 'started') return state.response as OperationReply<OperationOutputFor<TKey>>;
        await this.makerChecker.verify(transaction, makerCheckerInput(execution, input, claim));
      }
      const reply = await (handler as OperationHandler<TKey, 'write'>).execute(input, Object.freeze({ ...execution, transaction }));
      await this.auditReply(transaction, execution, input, reply);
      await appendEvents(this.outbox, transaction, reply.events);
      if (claim) await this.idempotency.complete(transaction, claim, reply as OperationReply<unknown>);
      return reply;
    });
  }

  private async durable<TKey extends OperationId, TPrepared, TCheckpoint, TLoaded>(
    handler: DurableOperationHandler<TKey, TPrepared, TCheckpoint, 'read' | 'write', TLoaded>,
    input: OperationInputFor<TKey>,
    execution: ExecutionContext<TKey>
  ): Promise<OperationReply<OperationOutputFor<TKey>>> {
    const operation = OperationCatalog.get(handler.operation);
    assertHandlerMode(operation.method, handler);
    const loaded = handler.load ? await this.transactions.read(transactionOptions(execution, undefined, handler.isolation), (transaction) => handler.load!(input, Object.freeze({ ...execution, transaction }))) : (undefined as TLoaded);
    const prepared = await handler.prepare(input, execution, loaded);
    const routedScope = transactionScope(handler, input, prepared, execution);
    const claim = requiresIdempotency(operation) ? idempotencyClaim(execution, input) : undefined;
    const auditedRead = operation.method === 'GET' && operation.permission !== null && ['high', 'critical'].includes(permissionDefinition(operation.permission).risk);
    let checkpointed = false;
    try {
      const transact = async (transaction: import('../platform/database/TransactionContext').ReadTransactionContext) => {
        if (claim) {
          const write = transaction as WriteTransactionContext;
          const state = await this.idempotency.claim(write, claim);
          if (state.state !== 'started') return Object.freeze({ replay: state.response as OperationReply<OperationOutputFor<TKey>> });
          await this.makerChecker.verify(write, makerCheckerInput(execution, input, claim));
        }
        const result = await handler.commit(input, prepared, Object.freeze({ ...execution, transaction }) as never);
        if (handler.mode === 'write' || auditedRead) {
          const write = transaction as WriteTransactionContext;
          await this.auditReply(write, execution, input, result.response, routedScope);
          await appendEvents(this.outbox, write, result.events ?? result.response.events);
          if (claim) await this.idempotency.checkpoint(write, claim, idempotencyResponse(handler, result.response) as OperationReply<unknown>);
        } else if ((result.events?.length ?? result.response.events?.length ?? 0) > 0) {
          throw new Error('READ_HANDLER_EVENT_FORBIDDEN');
        }
        return Object.freeze({ result });
      };
      const committed = handler.mode === 'write' || auditedRead ? await this.transactions.write(transactionOptions(execution, routedScope, handler.isolation), transact) : await this.transactions.read(transactionOptions(execution, routedScope, handler.isolation), transact);
      if ('replay' in committed) return committed.replay;
      checkpointed = true;

      const completionEvents: DomainEvent[] = [];
      const finalizeContext: FinalizeContext<TKey> = Object.freeze({
        ...execution,
        emit: async (event: DomainEvent) => {
          completionEvents.push(event);
        },
      });
      const reply = await handler.finalize(input, committed.result.checkpoint, finalizeContext);
      if (claim) {
        await this.transactions.write(transactionOptions(execution, routedScope, handler.isolation), async (transaction) => {
          await appendEvents(this.outbox, transaction, completionEvents);
          await appendEvents(this.outbox, transaction, reply.events);
          await this.idempotency.complete(transaction, claim, idempotencyResponse(handler, reply) as OperationReply<unknown>);
        });
      } else if (completionEvents.length > 0 || (reply.events?.length ?? 0) > 0) {
        throw new Error('READ_HANDLER_EVENT_FORBIDDEN');
      }
      return reply;
    } catch (cause) {
      if (!checkpointed) await handler.discard?.(prepared, cause);
      throw cause;
    }
  }

  private auditReply<TKey extends OperationId>(transaction: WriteTransactionContext, execution: ExecutionContext<TKey>, input: OperationInputFor<TKey>, reply: OperationReply<OperationOutputFor<TKey>>, scope?: string): Promise<void> {
    const identity = executionIdentity(execution, scope);
    const sensitive = OperationCatalog.get(execution.operation).sensitiveFields;
    const before = this.redactor.redactPaths(
      input,
      sensitive.filter((field) => !field.startsWith('response.'))
    );
    const object = resourceOf(before);
    return this.audit.append(transaction, execution.operation, {
      scope: identity.scope,
      actor: identity.actor,
      actorType: identity.actorType,
      request: execution.requestId,
      subject: Object.freeze({ type: identity.actorType, id: identity.actor }),
      object: Object.freeze({ type: OperationCatalog.get(execution.operation).module, id: object }),
      outcome: reply.status < 400 ? 'succeeded' : 'rejected',
      reason: `http:${reply.status}`,
      before,
      after: this.redactor.redactPaths(
        reply.body,
        sensitive.filter((field) => field.startsWith('response.')).map((field) => field.slice('response.'.length))
      ),
      evidence: Object.freeze({ status: reply.status, expectedVersion: execution.expectedVersion ?? null }),
      trace: execution.traceId,
    });
  }
}
