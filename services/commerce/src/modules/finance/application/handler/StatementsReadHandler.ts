import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { StatementReadRepository } from '../port/FinanceReadRepository';

export class StatementsReadHandler implements OperationHandler<'finance.statements.read', 'read'> {
  readonly operation = 'finance.statements.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly statements: StatementReadRepository) {}
  async execute(input: OperationInputFor<'finance.statements.read'>, context: HandlerContext<'finance.statements.read'>) {
    const result = await this.statements.statementsRead(context.transaction, input, context);
    return result;
  }
}
