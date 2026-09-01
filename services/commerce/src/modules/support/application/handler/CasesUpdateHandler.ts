import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { CaseRepository } from '../port/SupportRepositories';

export class CasesUpdateHandler implements OperationHandler<'support.cases.update', 'write'> {
  readonly operation = 'support.cases.update' as const;
  readonly mode = 'write' as const;
  constructor(private readonly cases: CaseRepository) {}
  execute(input: OperationInputFor<'support.cases.update'>, context: WriteHandlerContext<'support.cases.update'>): Promise<OperationReply<OperationOutputFor<'support.cases.update'>>> {
    const transaction = context.transaction;
    return this.cases.updateCase(transaction, input, context);
  }
}
