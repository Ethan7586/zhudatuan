import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadStateRepository } from '../port/SupportRepositories';

export class ReadstatesManageHandler implements OperationHandler<'support.readstates.manage', 'write'> {
  readonly operation = 'support.readstates.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly readstates: ReadStateRepository) {}
  execute(input: OperationInputFor<'support.readstates.manage'>, context: WriteHandlerContext<'support.readstates.manage'>): Promise<OperationReply<OperationOutputFor<'support.readstates.manage'>>> {
    return this.readstates.manageReadState(context.transaction, input, context);
  }
}
