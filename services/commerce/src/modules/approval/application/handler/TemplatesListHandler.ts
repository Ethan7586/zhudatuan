import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ApprovalApplication } from '../service/ApprovalApplication';

export class TemplatesListHandler implements OperationHandler<'approval.templates.list', 'read'> {
  readonly operation = 'approval.templates.list' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: ApprovalApplication) {}
  async execute(input: OperationInputFor<'approval.templates.list'>, context: HandlerContext<'approval.templates.list'>): Promise<OperationReply<OperationOutputFor<'approval.templates.list'>>> {
    return { status: 200, body: await this.application.list(input, context) };
  }
}
