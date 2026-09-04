import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { StatementProcessAdapter } from '../port/FinanceProcessAdapter';

export class BackfillsDecideHandler implements OperationHandler<'finance.backfills.decide', 'write'> {
  readonly operation = 'finance.backfills.decide' as const;
  readonly mode = 'write' as const;
  constructor(private readonly statements: StatementProcessAdapter) {}
  async execute(input: OperationInputFor<'finance.backfills.decide'>, context: WriteHandlerContext<'finance.backfills.decide'>) {
    const result = await this.statements.backfillsDecide(context.transaction, input, context);
    return result;
  }
}
