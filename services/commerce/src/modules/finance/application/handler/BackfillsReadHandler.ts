import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { StatementReadRepository } from '../port/FinanceReadRepository';

export class BackfillsReadHandler implements OperationHandler<'finance.backfills.read', 'read'> {
  readonly operation = 'finance.backfills.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly statements: StatementReadRepository) {}
  async execute(input: OperationInputFor<'finance.backfills.read'>, context: HandlerContext<'finance.backfills.read'>) {
    const result = await this.statements.backfillsRead(context.transaction, input, context);
    return result;
  }
}
