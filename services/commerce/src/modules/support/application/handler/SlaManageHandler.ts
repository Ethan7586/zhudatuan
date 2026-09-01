import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { SlaRepository } from '../port/SupportRepositories';

export class SlaManageHandler implements OperationHandler<'support.slas.manage', 'write'> {
  readonly operation = 'support.slas.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly slas: SlaRepository) {}
  execute(input: OperationInputFor<'support.slas.manage'>, context: WriteHandlerContext<'support.slas.manage'>): Promise<OperationReply<OperationOutputFor<'support.slas.manage'>>> {
    const transaction = context.transaction;
    return this.slas.manageSla(transaction, input, context);
  }
}
