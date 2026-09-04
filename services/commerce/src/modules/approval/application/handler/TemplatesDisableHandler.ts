import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ApprovalApplication } from '../service/ApprovalApplication';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { approvalEvent } from '../../domain/event/ApprovalEvents';

export class TemplatesDisableHandler implements OperationHandler<'approval.templates.disable', 'write'> {
  readonly operation = 'approval.templates.disable' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: ApprovalApplication) {}
  async execute(input: OperationInputFor<'approval.templates.disable'>, context: WriteHandlerContext<'approval.templates.disable'>): Promise<OperationReply<OperationOutputFor<'approval.templates.disable'>>> {
    const body = await this.application.setState(input, context, 'disabled');
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
          payload: { templateId: body.template.id, state: 'disabled', templateVersion: body.active.number },
        }),
      ],
    };
  }
}
