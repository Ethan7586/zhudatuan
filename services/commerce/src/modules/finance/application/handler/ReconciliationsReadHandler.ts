import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { ReconciliationReadRepository } from '../port/FinanceReadRepository';

export class ReconciliationsReadHandler implements OperationHandler<'finance.reconciliations.read', 'read'> {
  readonly operation = 'finance.reconciliations.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly statements: ReconciliationReadRepository) {}
  async execute(input: OperationInputFor<'finance.reconciliations.read'>, context: HandlerContext<'finance.reconciliations.read'>) {
    const result = await this.statements.reconciliationsRead(context.transaction, input, context);
    return result;
  }
}
