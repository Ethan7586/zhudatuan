import type { OperationOutputFor } from '@shop/contract';
import { deepFreeze } from '../../../shared/model/Immutable';
import type { ApprovalDecision, ApprovalInstance, ApprovalReceipt, ApprovalTask, ApprovalTaskPage, ApprovalTemplate, ApprovalTemplateDetail, ApprovalTemplatePage, ApprovalTemplateVersion } from '../model/Approval';

export class ApprovalMapper {
  templates(value: OperationOutputFor<'approval.templates.list'>): ApprovalTemplatePage {
    return deepFreeze({ kind: 'templates', items: value.items.map(template), count: value.count, ...(value.nextCursor === undefined ? {} : { nextCursor: value.nextCursor }) });
  }

  tasks(value: OperationOutputFor<'approval.tasks.list'>): ApprovalTaskPage {
    return deepFreeze({ kind: 'tasks', items: value.items.map(task), count: value.count, ...(value.nextCursor === undefined ? {} : { nextCursor: value.nextCursor }) });
  }

  template(value: OperationOutputFor<'approval.templates.get'>): ApprovalTemplateDetail {
    return deepFreeze({ kind: 'template', template: template(value.template), versions: value.versions.map(templateVersion) });
  }

  instance(value: OperationOutputFor<'approval.instances.get'>): ApprovalInstance {
    return deepFreeze({
      id: String(value.id),
      templateId: String(value.templateId),
      templateVersion: value.templateVersion,
      subjectKind: value.subjectKind,
      subjectId: String(value.subjectId),
      action: value.action,
      amountMinor: value.amountMinor,
      currency: value.currency,
      requesterId: String(value.requesterId),
      state: value.state,
      currentStep: value.currentStep,
      stepCount: value.stepCount,
      version: value.version,
      createdAt: value.createdAt,
      expiresAt: value.expiresAt,
      tasks: value.tasks.map(task),
      decisions: value.decisions.map(decision),
    });
  }

  templateReceipt(value: OperationOutputFor<'approval.templates.create'>): ApprovalReceipt {
    return Object.freeze({ id: value.template.id, state: value.template.state, version: value.template.version });
  }

  taskReceipt(value: OperationOutputFor<'approval.tasks.approve'>): ApprovalReceipt {
    return Object.freeze({
      id: String(value.task.id),
      state: value.instance.state,
      version: value.instance.version,
      instanceId: String(value.instance.id),
      subjectKind: value.instance.subjectKind,
      subjectId: value.instance.subjectId,
      subjectVersion: value.instance.subjectVersion,
      ...(value.decision.proof === null ? {} : { proof: value.decision.proof }),
    });
  }
}

function template(value: OperationOutputFor<'approval.templates.list'>['items'][number]): ApprovalTemplate {
  return Object.freeze({ id: String(value.id), code: value.code, name: value.name, subjectKind: value.subjectKind, state: value.state, activeVersion: value.activeVersion, version: value.version, updatedAt: value.updatedAt });
}

function templateVersion(value: OperationOutputFor<'approval.templates.get'>['versions'][number]): ApprovalTemplateVersion {
  return Object.freeze({
    id: String(value.id),
    number: value.number,
    name: value.name,
    subjectKind: value.subjectKind,
    steps: value.steps.map((step) => Object.freeze({ ...step, approvers: Object.freeze(step.approvers.map((approver) => Object.freeze({ ...approver }))) })),
    escalations: value.escalations.map((escalation) => Object.freeze({ afterHours: escalation.afterHours, action: escalation.action, ...(escalation.target === undefined ? {} : { target: escalation.target }) })),
    createdBy: String(value.createdBy),
    createdAt: value.createdAt,
  });
}

function task(value: OperationOutputFor<'approval.tasks.list'>['items'][number]): ApprovalTask {
  return Object.freeze({ id: String(value.id), instanceId: String(value.instanceId), sequence: value.sequence, name: value.name, assigneeKind: value.assigneeKind, assignee: value.assignee, state: value.state, dueAt: value.dueAt, minimumApprovals: value.minimumApprovals, approvalCount: value.approvalCount, version: value.version });
}

function decision(value: OperationOutputFor<'approval.instances.get'>['decisions'][number]): ApprovalDecision {
  return Object.freeze({ id: String(value.id), taskId: String(value.taskId), outcome: value.outcome, reason: value.reason, actorId: String(value.actorId), decidedAt: value.decidedAt });
}
