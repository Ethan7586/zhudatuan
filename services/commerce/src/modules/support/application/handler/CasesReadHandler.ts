import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { CaseRepository } from '../port/SupportRepositories';

export class CasesReadHandler implements OperationHandler<'support.cases.read', 'read'> {
  readonly operation = 'support.cases.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly cases: CaseRepository) {}
  execute(input: OperationInputFor<'support.cases.read'>, context: HandlerContext<'support.cases.read'>): Promise<OperationReply<OperationOutputFor<'support.cases.read'>>> {
    const transaction = context.transaction;
    return this.cases.readCases(transaction, input, context);
  }
}
