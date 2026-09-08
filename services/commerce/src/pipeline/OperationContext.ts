import { permissionDefinition } from '@shop/authz';
import { isConsumerTarget, OperationCatalog, type OperationId, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import { Redactor } from '@shop/telemetry';
import type { DomainEvent } from '@shop/kernel';
import { DomainError } from '../platform/error/DomainError';
import type { WriteTransactionContext } from '../platform/database/TransactionContext';
import type { TransactionIsolation, TransactionManager, TransactionOptions } from '../platform/database/TransactionManager';
import { sessionAccess } from '../platform/security/OperationSecurityContext';
import { authorizationEvidence } from '../platform/security/AuthorizationEvidence';
import type { AuditDecorator } from './AuditDecorator';
import type { ExecutionContext, FinalizeContext, HandlerContext } from './HandlerContext';
import type { IdempotencyClaim, IdempotencyRepository } from './IdempotencyRepository';
import { executionRequestHash } from './OperationHash';
import type { DurableOperationHandler, OperationHandler, OperationReply, RegisteredOperationHandler } from './OperationHandler';

interface TransactionalEventWriter {
  append(context: WriteTransactionContext, event: DomainEvent): Promise<void>;
  appendMany?(context: WriteTransactionContext, events: readonly DomainEvent[]): Promise<void>;
}

export function idempotencyResponse<TKey extends OperationId>(
  handler: DurableOperationHandler<TKey, unknown, unknown, 'read' | 'write', unknown>,
  response: OperationReply<OperationOutputFor<TKey>>
): OperationReply<OperationOutputFor<TKey>> {
  return handler.idempotencyResponse?.(response) ?? response;
}

export function transactionOptions(execution: ExecutionContext, scope?: string, isolation?: TransactionIsolation): TransactionOptions {
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
    ...(isolation === undefined ? {} : { isolation }),
    ...(access ? { authorization: authorizationEvidence(access, execution.operation, new Date()) } : {}),
  });
}

export function requiresIdempotency(operation: Readonly<{ method: string; idempotencyScope: string; audience: string }>): boolean {
  return operation.method !== 'GET' && operation.idempotencyScope !== 'none' && operation.audience !== 'webhook';
}

export function executionIdentity(execution: ExecutionContext, scope?: string): Readonly<{ tenant: string; membership: string; scope: string; actor: string; actorType: string }> {
  const access = sessionAccess(execution.security);
  if (scope !== undefined && access) throw new Error('TRANSACTION_SCOPE_OVERRIDE_FORBIDDEN');
  if (access) return Object.freeze({ tenant: access.scope.tenant ?? '', membership: access.membership.id, scope: access.scope.id, actor: access.actor.id, actorType: access.actor.target });
  if (!execution.publicActor) throw new Error('PUBLIC_ACTOR_REQUIRED');
  const target = execution.security.kind === 'anonymous' ? execution.security.channel : 'preauth';
  return Object.freeze({ tenant: '', membership: '', scope: scope ?? `public:${OperationCatalog.get(execution.operation).module}:${target}`, actor: execution.publicActor, actorType: 'public' });
}

export function transactionScope<TKey extends OperationId, TPrepared>(
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

export function idempotencyClaim<TKey extends OperationId>(execution: ExecutionContext<TKey>, input: OperationInputFor<TKey>): IdempotencyClaim {
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

export function makerCheckerInput(execution: ExecutionContext, input: unknown, claim: IdempotencyClaim) {
  return Object.freeze({
    operation: execution.operation,
    requestHash: claim.requestHash,
    resource: resourceOf(input) ?? claim.scope,
    ...(execution.expectedVersion === undefined ? {} : { expectedVersion: execution.expectedVersion }),
    ...(execution.actionProof === undefined ? {} : { actionProof: execution.actionProof }),
    execution,
  });
}

export function resourceOf(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const path = Reflect.get(input, 'path');
  if (!path || typeof path !== 'object' || Array.isArray(path)) return null;
  return Object.values(path as Record<string, unknown>).find((value): value is string => typeof value === 'string') ?? null;
}

export async function appendEvents(writer: TransactionalEventWriter, context: WriteTransactionContext, events: readonly DomainEvent[] | undefined): Promise<void> {
  if (!events || events.length === 0) return;
  if (writer.appendMany) return writer.appendMany(context, events);
  for (const event of events) await writer.append(context, event);
}

export function assertHandlerMode(method: string, handler: Readonly<{ operation: OperationId; mode: 'read' | 'write' }>): void {
  if (method === 'GET' || handler.mode === 'write') return;
  throw new Error(`HANDLER_MODE_MISMATCH:${handler.operation}:${handler.mode}:write`);
}
