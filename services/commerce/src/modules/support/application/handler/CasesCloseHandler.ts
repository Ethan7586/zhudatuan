import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { CaseRepository } from '../port/SupportRepositories';

export class CasesCloseHandler implements OperationHandler<'support.cases.close', 'write'> {
  readonly operation = 'support.cases.close' as const;
  readonly mode = 'write' as const;
  constructor(private readonly cases: CaseRepository) {}
  execute(input: OperationInputFor<'support.cases.close'>, context: WriteHandlerContext<'support.cases.close'>): Promise<OperationReply<OperationOutputFor<'support.cases.close'>>> {
    const transaction = context.transaction;
    return this.cases.closeCase(transaction, input, context);
  }
}
