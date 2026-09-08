import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { ApprovalApplication } from '../service/ApprovalApplication';

export class InstancesGetHandler implements OperationHandler<'approval.instances.get', 'read'> {
  readonly operation = 'approval.instances.get' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: ApprovalApplication) {}
  async execute(input: OperationInputFor<'approval.instances.get'>, context: HandlerContext<'approval.instances.get'>): Promise<OperationReply<OperationOutputFor<'approval.instances.get'>>> {
    return { status: 200, body: await this.application.instance(input, context) };
  }
}
