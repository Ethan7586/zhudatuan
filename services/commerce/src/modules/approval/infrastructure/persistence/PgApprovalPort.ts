import { createHash, randomUUID } from 'node:crypto';
import type { ApiErrorCode } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { TransactionalEventWriter } from '../../../../foundation/application/OperationExecutor';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { approvalEvent } from '../../domain/event/ApprovalEvents';
import { ApprovalSubject } from '../../domain/value/ApprovalSubject';
import type { ApprovalRepository } from '../../application/port/ApprovalRepository';
import type { ApprovalPort, ApprovalProofBinding, ApprovalRequest, ApprovalRequestReceipt, ApprovedActionProof } from '../../public';

export class PgApprovalPort implements ApprovalPort {
  constructor(
    private readonly approvals: ApprovalRepository,
    private readonly outbox: TransactionalEventWriter
  ) {}

  async request(context: WriteTransactionContext, request: ApprovalRequest): Promise<ApprovalRequestReceipt> {
    assertCaller(context, request.scopeId, request.requesterId);
    const subject = new ApprovalSubject(request.subject);
    const action = actionName(request.action);
    const evidenceHash = digest(request.evidenceHash, 'APPROVAL_EVIDENCE_HASH_INVALID');
    const money = approvalMoney(request.amountMinor, request.currency);
    const expiresAt = futureTime(request.expiresAt);
    const id = `approvalinstance:${randomUUID()}`;
    const created = await this.approvals.createInstance(context, {
      id,
      scopeId: request.scopeId,
      requesterId: request.requesterId,
      subjectKind: subject.kind,
      subjectId: subject.id,
      subjectVersion: subject.version,
      subjectSnapshot: subject.snapshot,
      action,
      evidenceHash,
      amountMinor: money.amountMinor,
      currency: money.currency,
      constraints: frozenRecord(request.constraints),
      expiresAt,
    });
    if (!created) throw new DomainError('APPROVAL_TEMPLATE_DISABLED');
    const requestedAt = created.instance.createdAt;
    await this.outbox.append(
      context,
      approvalEvent({
        type: 'approval.instance.created',
        aggregateType: 'approvalinstance',
        aggregateId: created.instance.id,
        aggregateVersion: created.instance.version,
        scopeId: request.scopeId,
        actorId: request.requesterId,
        traceId: context.trace,
        occurredAt: requestedAt,
        payload: { instanceId: id, subjectKind: subject.kind, subjectId: subject.id, subjectVersion: subject.version, action },
      })
    );
    for (const task of created.assigned) {
      await this.outbox.append(
        context,
        approvalEvent({
          type: 'approval.task.assigned',
          aggregateType: 'approvaltask',
          aggregateId: task.id,
          aggregateVersion: task.version,
          scopeId: request.scopeId,
          actorId: request.requesterId,
          traceId: context.trace,
          occurredAt: requestedAt,
          payload: { taskId: task.id, instanceId: id, assigneeKind: task.assigneeKind, assignee: task.assignee, dueAt: task.dueAt },
        })
      );
    }
    return Object.freeze({
      instanceId: id,
      state: 'pending',
      templateId: created.instance.templateId,
      templateVersion: created.instance.templateVersion,
      version: created.instance.version,
      requestedAt,
    });
  }

  async cancel(
    context: WriteTransactionContext,
    command: Readonly<{ scopeId: string; instanceId: string; requesterId: string; expectedVersion: number; reason: string }>
  ): Promise<Readonly<{ instanceId: string; state: 'cancelled'; version: number }>> {
    assertCaller(context, command.scopeId, command.requesterId);
    const reason = requiredText(command.reason, 500);
    const current = await this.approvals.getInstance(context, command.scopeId, command.instanceId);
    if (!current) throw new DomainError('RESOURCE_NOT_FOUND');
    const cancelled = await this.approvals.cancelInstance(context, {
      scopeId: command.scopeId,
      id: command.instanceId,
      requesterId: command.requesterId,
      expectedVersion: command.expectedVersion,
      reason,
    });
    if (!cancelled) throw new DomainError('APPROVAL_INSTANCE_CONFLICT');
    await this.outbox.append(
      context,
      approvalEvent({
        type: 'approval.instance.cancelled',
        aggregateType: 'approvalinstance',
        aggregateId: current.id,
        aggregateVersion: cancelled.version,
        scopeId: command.scopeId,
        actorId: command.requesterId,
        traceId: context.trace,
        payload: { instanceId: current.id, subjectKind: current.subjectKind, subjectId: current.subjectId, reason },
      })
    );
    return Object.freeze({ instanceId: cancelled.id, state: 'cancelled', version: cancelled.version });
  }

  async consume(context: WriteTransactionContext, token: string, binding: ApprovalProofBinding): Promise<ApprovedActionProof> {
    if (binding.scopeId !== context.scope || !context.membership) throw new DomainError('SCOPE_DENIED');
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new DomainError('APPROVAL_PROOF_INVALID');
    const money = approvalMoney(binding.amountMinor ?? undefined, binding.currency ?? undefined);
    const consumed = await this.approvals.consumeProof(context, {
      tokenHash: createHash('sha256').update(token).digest(),
      scopeId: binding.scopeId,
      subjectKind: binding.subjectKind,
      subjectId: requiredText(binding.subjectId, 255),
      subjectVersion: natural(binding.subjectVersion),
      action: actionName(binding.action),
      evidenceHash: digest(binding.evidenceHash, 'APPROVAL_EVIDENCE_HASH_INVALID'),
      amountMinor: money.amountMinor,
      currency: money.currency,
      constraints: frozenRecord(binding.constraints),
      consumerOperation: actionName(binding.consumerOperation),
      requestHash: digest(binding.requestHash, 'APPROVAL_REQUEST_HASH_INVALID'),
      consumerId: context.membership,
    });
    if (!consumed) throw new DomainError('APPROVAL_PROOF_INVALID');
    return Object.freeze({
      proofId: consumed.id,
      instanceId: consumed.instanceId,
      checkerId: consumed.checkerId,
      binding: Object.freeze({ ...binding, constraints: frozenRecord(binding.constraints) }),
      issuedAt: consumed.issuedAt,
      expiresAt: consumed.expiresAt,
    });
  }
}

function assertCaller(context: WriteTransactionContext, scopeId: string, requesterId: string): void {
  if (context.scope !== scopeId) throw new DomainError('SCOPE_DENIED');
  if (!context.membership || context.membership !== requesterId) throw new DomainError('AUTHORIZATION_DENIED');
}

function actionName(value: string): string {
  const normalized = requiredText(value, 120);
  if (!/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(normalized)) throw new DomainError('VALIDATION_FAILED');
  return normalized;
}

function digest(value: string, code: ApiErrorCode): string {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new DomainError(code);
  return value;
}

function natural(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new DomainError('VALIDATION_FAILED');
  return value;
}

function approvalMoney(amountMinor: number | undefined, currency: string | undefined): Readonly<{ amountMinor: number | null; currency: string | null }> {
  if (amountMinor === undefined && currency === undefined) return Object.freeze({ amountMinor: null, currency: null });
  if (amountMinor === undefined || currency === undefined || !Number.isSafeInteger(amountMinor) || amountMinor < 0 || !/^[A-Z]{3}$/.test(currency)) {
    throw new DomainError('VALIDATION_FAILED');
  }
  return Object.freeze({ amountMinor, currency });
}

function futureTime(value: string | null): string | null {
  if (value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now() || parsed.getTime() > Date.now() + 366 * 24 * 60 * 60_000) throw new DomainError('VALIDATION_FAILED');
  return parsed.toISOString();
}

function requiredText(value: string, maximum: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new DomainError('VALIDATION_FAILED');
  return normalized;
}

function frozenRecord(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('VALIDATION_FAILED');
  return Object.freeze({ ...value });
}
