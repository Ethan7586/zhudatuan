import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ApprovalApplication } from '../service/ApprovalApplication';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { approvalEvent } from '../../domain/event/ApprovalEvents';

export class TasksApproveHandler implements OperationHandler<'approval.tasks.approve', 'write'> {
  readonly operation = 'approval.tasks.approve' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: ApprovalApplication) {}
  async execute(input: OperationInputFor<'approval.tasks.approve'>, context: WriteHandlerContext<'approval.tasks.approve'>): Promise<OperationReply<OperationOutputFor<'approval.tasks.approve'>>> {
    const body = await this.application.decide(input, context, 'approved');
    const access = requireSession(context.security);
    const occurredAt = body.decision.decidedAt;
    const events = [
      approvalEvent({
        type: 'approval.task.decided',
        aggregateType: 'approvaltask',
        aggregateId: body.task.id,
        aggregateVersion: body.task.version,
        scopeId: access.scope.id,
        actorId: access.membership.id,
        traceId: context.traceId,
        occurredAt,
        payload: { taskId: body.task.id, instanceId: body.instance.id, outcome: 'approved', actorId: access.membership.id, decidedAt: occurredAt },
      }),
    ];
    if (body.instance.state === 'approved' && body.decision.proofId) {
      events.push(
        approvalEvent({
          type: 'approval.instance.approved',
          aggregateType: 'approvalinstance',
          aggregateId: body.instance.id,
          aggregateVersion: body.instance.version,
          scopeId: access.scope.id,
          actorId: access.membership.id,
          traceId: context.traceId,
          occurredAt,
          payload: {
            instanceId: body.instance.id,
            subjectKind: body.instance.subjectKind,
            subjectId: body.instance.subjectId,
            subjectVersion: body.instance.subjectVersion,
            action: body.instance.action,
            proofId: body.decision.proofId,
          },
        })
      );
    }
    if (body.instance.state === 'pending' && body.instance.currentStep > body.task.sequence) {
      for (const task of body.instance.tasks.filter(({ sequence, state }) => sequence === body.instance.currentStep && state === 'pending')) {
        events.push(
          approvalEvent({
            type: 'approval.task.assigned',
            aggregateType: 'approvaltask',
            aggregateId: task.id,
            aggregateVersion: task.version,
            scopeId: access.scope.id,
            actorId: access.membership.id,
            traceId: context.traceId,
            occurredAt,
            payload: { taskId: task.id, instanceId: body.instance.id, assigneeKind: task.assigneeKind, assignee: task.assignee, dueAt: task.dueAt },
          })
        );
      }
    }
    return { status: 200, body, events };
  }
}
