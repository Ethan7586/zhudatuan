import { permissionDefinition } from '@shop/authz';
import { isConsumerTarget, OperationCatalog, type OperationId, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import { Redactor } from '@shop/telemetry';
import type { DomainEvent } from '../domain/DomainEvent';
import { DomainError } from '../domain/DomainError';
import type { WriteTransactionContext } from '../persistence/TransactionContext';
import type { TransactionManager, TransactionOptions } from '../persistence/TransactionManager';
import { sessionAccess } from '../security/OperationSecurityContext';
import { authorizationEvidence } from '../security/AuthorizationEvidence';
import type { AuditDecorator } from './AuditDecorator';
import type { ExecutionContext, FinalizeContext, HandlerContext } from './HandlerContext';
import type { IdempotencyClaim, IdempotencyRepository } from './IdempotencyRepository';
import { executionRequestHash } from './OperationHash';
import type { DurableOperationHandler, OperationHandler, OperationReply, RegisteredOperationHandler } from './OperationHandler';

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
      return this.transactions.read(transactionOptions(execution), (transaction) => (handler as OperationHandler<TKey, 'read'>).execute(input, Object.freeze({ ...execution, transaction }) as HandlerContext<TKey>));
    }
    return this.transactions.write(transactionOptions(execution), async (transaction) => {
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
    const loaded = handler.load ? await this.transactions.read(transactionOptions(execution), (transaction) => handler.load!(input, Object.freeze({ ...execution, transaction }))) : (undefined as TLoaded);
    const prepared = await handler.prepare(input, execution, loaded);
    const routedScope = transactionScope(handler, input, prepared, execution);
    const claim = requiresIdempotency(operation) ? idempotencyClaim(execution, input) : undefined;
    const auditedRead = operation.method === 'GET' && operation.permission !== null && ['high', 'critical'].includes(permissionDefinition(operation.permission).risk);
    let checkpointed = false;
    try {
      const transact = async (transaction: import('../persistence/TransactionContext').ReadTransactionContext) => {
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
      const committed = handler.mode === 'write' || auditedRead ? await this.transactions.write(transactionOptions(execution, routedScope), transact) : await this.transactions.read(transactionOptions(execution, routedScope), transact);
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
        await this.transactions.write(transactionOptions(execution, routedScope), async (transaction) => {
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
    const before = this.redactor.redactPaths(input, sensitive.filter(field => !field.startsWith('response.')));
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
      after: this.redactor.redactPaths(reply.body, sensitive.filter(field => field.startsWith('response.')).map(field => field.slice('response.'.length))),
      evidence: Object.freeze({ status: reply.status, expectedVersion: execution.expectedVersion ?? null }),
      trace: execution.traceId,
    });
  }
}

function idempotencyResponse<TKey extends OperationId>(handler: DurableOperationHandler<TKey, unknown, unknown, 'read' | 'write', unknown>, response: OperationReply<OperationOutputFor<TKey>>): OperationReply<OperationOutputFor<TKey>> {
  return handler.idempotencyResponse?.(response) ?? response;
}

function transactionOptions(execution: ExecutionContext, scope?: string): TransactionOptions {
  const identity = executionIdentity(execution, scope);
  const access = sessionAccess(execution.security);
  return Object.freeze({
    tenant: identity.tenant,
    membership: identity.membership,
    scope: identity.scope,
    actor: identity.actor,
    trace: execution.traceId,
    operation: execution.operation,
    deadline: execution.deadline,
    signal: execution.signal,
    workload: 'api',
    ...(access ? { authorization: authorizationEvidence(access, execution.operation, new Date()) } : {}),
  });
}

function requiresIdempotency(operation: Readonly<{ method: string; idempotencyScope: string; audience: string }>): boolean {
  return operation.method !== 'GET' && operation.idempotencyScope !== 'none' && operation.audience !== 'webhook';
}

function executionIdentity(execution: ExecutionContext, scope?: string): Readonly<{ tenant: string; membership: string; scope: string; actor: string; actorType: string }> {
  const access = sessionAccess(execution.security);
  if (scope !== undefined && access) throw new Error('TRANSACTION_SCOPE_OVERRIDE_FORBIDDEN');
  if (access) return Object.freeze({ tenant: access.scope.tenant ?? '', membership: access.membership.id, scope: access.scope.id, actor: access.actor.id, actorType: access.actor.target });
  if (!execution.publicActor) throw new Error('PUBLIC_ACTOR_REQUIRED');
  const target = execution.security.kind === 'anonymous' ? execution.security.channel : 'preauth';
  return Object.freeze({ tenant: '', membership: '', scope: scope ?? `public:${OperationCatalog.get(execution.operation).module}:${target}`, actor: execution.publicActor, actorType: 'public' });
}

function transactionScope<TKey extends OperationId, TPrepared>(
  handler: Readonly<{ transactionScope?(input: OperationInputFor<TKey>, prepared: TPrepared, context: ExecutionContext<TKey>): string | undefined }>,
  input: OperationInputFor<TKey>,
  prepared: TPrepared,
  execution: ExecutionContext<TKey>
): string | undefined {
  const scope = handler.transactionScope?.(input, prepared, execution);
  if (scope === undefined) return undefined;
  const operation = OperationCatalog.get(execution.operation);
  const webhook = operation.audience === 'webhook' && execution.security.kind === 'anonymous' && execution.security.channel === 'webhook';
  const publicFlow = operation.audience === 'public' && ((execution.security.kind === 'anonymous' && execution.security.channel === 'public') || execution.security.kind === 'preauth');
  const anonymousStorefront = operation.audience === 'storefront' && operation.assuranceLevel === 'optional' && execution.security.kind === 'anonymous' && isConsumerTarget(execution.security.target);
  if (!webhook && !publicFlow && !anonymousStorefront) throw new Error('TRANSACTION_SCOPE_OVERRIDE_FORBIDDEN');
  if (!/^[A-Za-z0-9][A-Za-z0-9:.-]{0,255}$/.test(scope)) throw new Error('TRANSACTION_SCOPE_INVALID');
  return scope;
}

function idempotencyClaim<TKey extends OperationId>(execution: ExecutionContext<TKey>, input: OperationInputFor<TKey>): IdempotencyClaim {
  if (!execution.idempotencyKey) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED');
  const identity = executionIdentity(execution);
  return Object.freeze({
    scope: identity.scope,
    actor: identity.actor,
    operation: execution.operation,
    key: execution.idempotencyKey,
    requestHash: executionRequestHash(execution.operation, input, execution.expectedVersion),
  });
}

function makerCheckerInput(execution: ExecutionContext, input: unknown, claim: IdempotencyClaim) {
  return Object.freeze({
    operation: execution.operation,
    requestHash: claim.requestHash,
    resource: resourceOf(input) ?? claim.scope,
    ...(execution.expectedVersion === undefined ? {} : { expectedVersion: execution.expectedVersion }),
    ...(execution.actionProof === undefined ? {} : { actionProof: execution.actionProof }),
    execution,
  });
}

function resourceOf(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const path = Reflect.get(input, 'path');
  if (!path || typeof path !== 'object' || Array.isArray(path)) return null;
  return Object.values(path as Record<string, unknown>).find((value): value is string => typeof value === 'string') ?? null;
}

async function appendEvents(writer: TransactionalEventWriter, context: WriteTransactionContext, events: readonly DomainEvent[] | undefined): Promise<void> {
  if (!events || events.length === 0) return;
  if (writer.appendMany) return writer.appendMany(context, events);
  for (const event of events) await writer.append(context, event);
}

function assertHandlerMode(method: string, handler: Readonly<{ operation: OperationId; mode: 'read' | 'write' }>): void {
  if (method === 'GET' || handler.mode === 'write') return;
  throw new Error(`HANDLER_MODE_MISMATCH:${handler.operation}:${handler.mode}:write`);
}
