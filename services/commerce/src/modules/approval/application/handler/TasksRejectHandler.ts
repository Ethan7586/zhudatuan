import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { ApprovalApplication } from '../service/ApprovalApplication';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { approvalEvent } from '../../domain/event/ApprovalEvents';

export class TasksRejectHandler implements OperationHandler<'approval.tasks.reject', 'write'> {
  readonly operation = 'approval.tasks.reject' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: ApprovalApplication) {}
  async execute(input: OperationInputFor<'approval.tasks.reject'>, context: WriteHandlerContext<'approval.tasks.reject'>): Promise<OperationReply<OperationOutputFor<'approval.tasks.reject'>>> {
    const body = await this.application.decide(input, context, 'rejected');
    const access = requireSession(context.security);
    const occurredAt = body.decision.decidedAt;
    return {
      status: 200,
      body,
      events: [
        approvalEvent({
          type: 'approval.task.decided',
          aggregateType: 'approvaltask',
          aggregateId: body.task.id,
          aggregateVersion: body.task.version,
          scopeId: access.scope.id,
          actorId: access.membership.id,
          traceId: context.traceId,
          occurredAt,
          payload: { taskId: body.task.id, instanceId: body.instance.id, outcome: 'rejected', actorId: access.membership.id, decidedAt: occurredAt },
        }),
        approvalEvent({
          type: 'approval.instance.rejected',
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
            reason: body.decision.reason,
          },
        }),
      ],
    };
  }
}
