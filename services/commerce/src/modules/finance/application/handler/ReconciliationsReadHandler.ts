import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { StatementRepository } from '../port/OperationRepositories';

export class ReconciliationsReadHandler implements OperationHandler<'finance.reconciliations.read', 'read'> {
  readonly operation = 'finance.reconciliations.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly statements: StatementRepository) {}
  async execute(input: OperationInputFor<'finance.reconciliations.read'>, context: HandlerContext<'finance.reconciliations.read'>) {
    const result = await this.statements.reconciliationsRead(context.transaction, input, context);
    return result;
  }
}
