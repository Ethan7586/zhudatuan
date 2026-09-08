import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { ApprovalApplication } from '../service/ApprovalApplication';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { approvalEvent } from '../../domain/event/ApprovalEvents';

export class TemplatesEnableHandler implements OperationHandler<'approval.templates.enable', 'write'> {
  readonly operation = 'approval.templates.enable' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: ApprovalApplication) {}
  async execute(input: OperationInputFor<'approval.templates.enable'>, context: WriteHandlerContext<'approval.templates.enable'>): Promise<OperationReply<OperationOutputFor<'approval.templates.enable'>>> {
    const body = await this.application.setState(input, context, 'enabled');
    const access = requireSession(context.security);
    return {
      status: 200,
      body,
      events: [
        approvalEvent({
          type: 'approval.template.statechanged',
          aggregateType: 'approvaltemplate',
          aggregateId: body.template.id,
          aggregateVersion: body.template.version,
          scopeId: access.scope.id,
          actorId: access.membership.id,
          traceId: context.traceId,
          payload: { templateId: body.template.id, state: 'enabled', templateVersion: body.active.number },
        }),
      ],
    };
  }
}
