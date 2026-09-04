import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ApprovalApplication } from '../service/ApprovalApplication';

export class TemplatesGetHandler implements OperationHandler<'approval.templates.get', 'read'> {
  readonly operation = 'approval.templates.get' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: ApprovalApplication) {}
  async execute(input: OperationInputFor<'approval.templates.get'>, context: HandlerContext<'approval.templates.get'>): Promise<OperationReply<OperationOutputFor<'approval.templates.get'>>> {
    return { status: 200, body: await this.application.get(input, context) };
  }
}
