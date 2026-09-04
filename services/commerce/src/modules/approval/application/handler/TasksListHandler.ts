import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ApprovalApplication } from '../service/ApprovalApplication';

export class TasksListHandler implements OperationHandler<'approval.tasks.list', 'read'> {
  readonly operation = 'approval.tasks.list' as const;
  readonly mode = 'read' as const;
  constructor(private readonly application: ApprovalApplication) {}
  async execute(input: OperationInputFor<'approval.tasks.list'>, context: HandlerContext<'approval.tasks.list'>): Promise<OperationReply<OperationOutputFor<'approval.tasks.list'>>> {
    return { status: 200, body: await this.application.tasks(input, context) };
  }
}
