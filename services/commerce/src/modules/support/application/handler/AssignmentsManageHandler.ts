import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { AssignmentRepository } from '../port/SupportRepositories';

export class AssignmentsManageHandler implements OperationHandler<'support.assignments.manage', 'write'> {
  readonly operation = 'support.assignments.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly assignments: AssignmentRepository) {}
  execute(input: OperationInputFor<'support.assignments.manage'>, context: WriteHandlerContext<'support.assignments.manage'>): Promise<OperationReply<OperationOutputFor<'support.assignments.manage'>>> {
    const transaction = context.transaction;
    return this.assignments.manageAssignment(transaction, input, context);
  }
}
