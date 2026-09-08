import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { CaseRepository } from '../port/SupportRepositories';

export class HistoryReadHandler implements OperationHandler<'support.history.read', 'read'> {
  readonly operation = 'support.history.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly cases: CaseRepository) {}
  execute(input: OperationInputFor<'support.history.read'>, context: HandlerContext<'support.history.read'>): Promise<OperationReply<OperationOutputFor<'support.history.read'>>> {
    const transaction = context.transaction;
    return this.cases.readHistory(transaction, input, context);
  }
}
