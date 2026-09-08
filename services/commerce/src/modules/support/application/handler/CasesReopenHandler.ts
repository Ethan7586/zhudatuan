import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { CaseRepository } from '../port/SupportRepositories';

export class CasesReopenHandler implements OperationHandler<'support.cases.reopen', 'write'> {
  readonly operation = 'support.cases.reopen' as const;
  readonly mode = 'write' as const;
  constructor(private readonly cases: CaseRepository) {}
  execute(input: OperationInputFor<'support.cases.reopen'>, context: WriteHandlerContext<'support.cases.reopen'>): Promise<OperationReply<OperationOutputFor<'support.cases.reopen'>>> {
    const transaction = context.transaction;
    return this.cases.reopenCase(transaction, input, context);
  }
}
