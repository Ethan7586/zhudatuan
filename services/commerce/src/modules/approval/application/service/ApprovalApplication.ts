import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { HandlerContext, WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import { bodyRecord, keysetPage, optionalText, queryPage, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { ApprovalInstance } from '../../domain/model/ApprovalInstance';
import { ApprovalTask } from '../../domain/model/ApprovalTask';
import { ApprovalTemplate, type ApprovalStep } from '../../domain/model/ApprovalTemplate';
import { ApproverPolicy } from '../../domain/policy/ApproverPolicy';
import { ApprovalDecision } from '../../domain/value/ApprovalDecision';
import type { ApprovalSubjectKind } from '../../domain/value/ApprovalSubject';
import type { ApprovalRepository, ApprovalTemplateCommand } from '../port/ApprovalRepository';

import { approvalEscalations, approvalSteps, assertBodyVersion, integer, objectField, queryText, requiredVersion, subjectKinds, text } from './ApprovalValue';
export class ApprovalApplication {
  private readonly approver = new ApproverPolicy();

  constructor(private readonly approvals: ApprovalRepository) {}

  async create(input: OperationInputFor<'approval.templates.create'>, context: WriteHandlerContext<'approval.templates.create'>): Promise<OperationOutputFor<'approval.templates.create'>> {
    const created = await this.approvals.createTemplate(context.transaction, this.templateCommand(input, context, `approvaltemplate:${randomUUID()}`, null));
    if (!created) throw new DomainError('APPROVAL_TEMPLATE_CODE_CONFLICT');
    return created as OperationOutputFor<'approval.templates.create'>;
  }

  async revise(input: OperationInputFor<'approval.templates.revise'>, context: WriteHandlerContext<'approval.templates.revise'>): Promise<OperationOutputFor<'approval.templates.revise'>> {
    const result = await this.approvals.reviseTemplate(context.transaction, this.templateCommand(input, context, input.path.templateid, requiredVersion(context)));
    if (!result) throw new DomainError('APPROVAL_TEMPLATE_VERSION_CONFLICT');
    return result as OperationOutputFor<'approval.templates.revise'>;
  }

  async setState<TId extends 'approval.templates.enable' | 'approval.templates.disable'>(input: OperationInputFor<TId>, context: WriteHandlerContext<TId>, state: 'enabled' | 'disabled'): Promise<OperationOutputFor<TId>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    textField(body, 'reason', 500);
    assertBodyVersion(body, context);
    const result = await this.approvals.setTemplateState(context.transaction, {
      id: input.path.templateid,
      scopeId: access.scope.id,
      state,
      actorId: access.membership.id,
      expectedVersion: requiredVersion(context),
    });
    if (result === 'subjectconflict') throw new DomainError('APPROVAL_TEMPLATE_ACTIVE_CONFLICT');
    if (!result) throw new DomainError('APPROVAL_TEMPLATE_VERSION_CONFLICT');
    return result as OperationOutputFor<TId>;
  }

  async get(input: OperationInputFor<'approval.templates.get'>, context: HandlerContext<'approval.templates.get'>): Promise<OperationOutputFor<'approval.templates.get'>> {
    const access = requireSession(context.security);
    const result = await this.approvals.getTemplate(context.transaction, access.scope.id, input.path.templateid);
    if (!result) throw new DomainError('RESOURCE_NOT_FOUND');
    return result as OperationOutputFor<'approval.templates.get'>;
  }

  async list(input: OperationInputFor<'approval.templates.list'>, context: HandlerContext<'approval.templates.list'>): Promise<OperationOutputFor<'approval.templates.list'>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.approvals.listTemplates(context.transaction, {
      scopeId: access.scope.id,
      state: queryText(input, 'state'),
      subjectKind: queryText(input, 'subjectKind'),
      sort: page.sort,
      id: page.id,
      fetch: page.fetch,
    });
    return keysetPage(rows, page, 'id') as OperationOutputFor<'approval.templates.list'>;
  }

  async tasks(input: OperationInputFor<'approval.tasks.list'>, context: HandlerContext<'approval.tasks.list'>): Promise<OperationOutputFor<'approval.tasks.list'>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.approvals.listTasks(context.transaction, {
      scopeId: access.scope.id,
      membership: access.membership.id,
      permissions: [...access.membership.permissions.allows],
      roles: access.roles.map(({ id }) => id),
      state: queryText(input, 'state'),
      subjectKind: queryText(input, 'subjectKind'),
      sort: page.sort,
      id: page.id,
      fetch: page.fetch,
    });
    return keysetPage(rows, page, 'id') as OperationOutputFor<'approval.tasks.list'>;
  }

  async instance(input: OperationInputFor<'approval.instances.get'>, context: HandlerContext<'approval.instances.get'>): Promise<OperationOutputFor<'approval.instances.get'>> {
    const access = requireSession(context.security);
    const result = await this.approvals.getInstance(context.transaction, access.scope.id, input.path.instanceid);
    if (!result) throw new DomainError('RESOURCE_NOT_FOUND');
    return result as OperationOutputFor<'approval.instances.get'>;
  }

  async decide<TId extends 'approval.tasks.approve' | 'approval.tasks.reject'>(input: OperationInputFor<TId>, context: WriteHandlerContext<TId>, outcome: 'approved' | 'rejected'): Promise<OperationOutputFor<TId>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    assertBodyVersion(body, context);
    const decision = new ApprovalDecision({ outcome, reason: textField(body, 'reason', 500), evidence: objectField(body, 'evidence') });
    const snapshot = await this.approvals.lockTask(context.transaction, access.scope.id, input.path.taskid);
    if (!snapshot) throw new DomainError('RESOURCE_NOT_FOUND');
    const now = new Date();
    const task = new ApprovalTask({
      id: snapshot.task.id,
      state: snapshot.task.state,
      requester: snapshot.instance.requesterId,
      dueAt: snapshot.task.dueAt === null ? null : new Date(snapshot.task.dueAt),
      minimumApprovals: snapshot.task.minimumApprovals,
      approvalCount: snapshot.task.approvalCount,
      version: snapshot.task.version,
    });
    const taskState = task.decide(outcome, requiredVersion(context), now);
    this.approver.assertAssigned(
      { kind: snapshot.task.assigneeKind, value: snapshot.task.assignee },
      {
        membership: access.membership.id,
        requester: snapshot.instance.requesterId,
        principal: access.actor.id,
        requesterPrincipal: snapshot.requesterPrincipal,
        permissions: access.membership.permissions.allows,
        roles: new Set(access.roles.map(({ id }) => id)),
      }
    );
    const instance = new ApprovalInstance({
      id: snapshot.instance.id,
      state: snapshot.instance.state,
      requester: snapshot.instance.requesterId,
      currentStep: snapshot.instance.currentStep,
      stepCount: snapshot.instance.stepCount,
      expiresAt: snapshot.instance.expiresAt === null ? null : new Date(snapshot.instance.expiresAt),
      version: snapshot.instance.version,
    });
    const stepSatisfied =
      outcome === 'approved' &&
      taskState === 'approved' &&
      snapshot.instance.tasks.filter(({ sequence }) => sequence === snapshot.instance.currentStep).every((candidate) => candidate.id === snapshot.task.id || candidate.state === 'approved');
    const transition = instance.decide(outcome, now, stepSatisfied);
    const proofToken = transition.state === 'approved' ? randomBytes(32).toString('base64url') : null;
    const proofId = proofToken === null ? null : `approvalproof:${randomUUID()}`;
    const proofExpiresAt = proofToken === null ? null : new Date(Math.min(snapshot.instance.expiresAt === null ? Number.POSITIVE_INFINITY : new Date(snapshot.instance.expiresAt).getTime(), now.getTime() + 15 * 60_000)).toISOString();
    const result = await this.approvals.decideTask(context.transaction, {
      decisionId: `approvaldecision:${randomUUID()}`,
      id: snapshot.task.id,
      scopeId: access.scope.id,
      membership: access.membership.id,
      outcome: decision.outcome,
      reason: decision.reason,
      evidence: decision.evidence,
      proofHash: proofToken === null ? null : createHash('sha256').update(proofToken).digest(),
      proofToken,
      proofId,
      proofExpiresAt,
      taskState,
      instanceVersion: snapshot.instance.version,
      expectedVersion: requiredVersion(context),
      nextState: transition.state,
      nextStep: transition.nextStep,
    });
    if (!result) throw new DomainError('APPROVAL_TASK_CONFLICT');
    return result as OperationOutputFor<TId>;
  }

  private templateCommand<TId extends OperationId>(input: OperationInputFor<TId>, context: WriteHandlerContext<TId>, id: string, expectedVersion: number | null): ApprovalTemplateCommand {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    if (expectedVersion !== null) assertBodyVersion(body, context);
    const kind = textField(body, 'subjectKind') as ApprovalSubjectKind;
    if (!subjectKinds.has(kind)) throw new DomainError('VALIDATION_FAILED');
    const steps = approvalSteps(body.steps);
    const template = new ApprovalTemplate({ code: textField(body, 'code', 64), name: textField(body, 'name', 120), subjectKind: kind, steps });
    return {
      id,
      scopeId: access.scope.id,
      code: template.code,
      name: template.name,
      subjectKind: template.subjectKind,
      steps: template.steps,
      escalations: approvalEscalations(body.escalations),
      actorId: access.membership.id,
      expectedVersion,
    };
  }
}
