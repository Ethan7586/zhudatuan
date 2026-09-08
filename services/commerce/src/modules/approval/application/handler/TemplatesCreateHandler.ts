import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { ApprovalApplication } from '../service/ApprovalApplication';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { approvalEvent } from '../../domain/event/ApprovalEvents';

export class TemplatesCreateHandler implements OperationHandler<'approval.templates.create', 'write'> {
  readonly operation = 'approval.templates.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: ApprovalApplication) {}
  async execute(input: OperationInputFor<'approval.templates.create'>, context: WriteHandlerContext<'approval.templates.create'>): Promise<OperationReply<OperationOutputFor<'approval.templates.create'>>> {
    const body = await this.application.create(input, context);
    const access = requireSession(context.security);
    return {
      status: 201,
      body,
      events: [
        approvalEvent({
          type: 'approval.template.created',
          aggregateType: 'approvaltemplate',
          aggregateId: body.template.id,
          aggregateVersion: body.template.version,
          scopeId: access.scope.id,
          actorId: access.membership.id,
          traceId: context.traceId,
          payload: { templateId: body.template.id, subjectKind: body.template.subjectKind, templateVersion: body.active.number },
        }),
      ],
    };
  }
}
