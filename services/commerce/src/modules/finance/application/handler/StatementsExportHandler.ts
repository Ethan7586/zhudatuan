import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { StatementRepository } from '../port/OperationRepositories';

export class StatementsExportHandler implements OperationHandler<'finance.statements.export', 'write'> {
  readonly operation = 'finance.statements.export' as const;
  readonly mode = 'write' as const;
  constructor(private readonly statements: StatementRepository) {}
  async execute(input: OperationInputFor<'finance.statements.export'>, context: WriteHandlerContext<'finance.statements.export'>) {
    const result = await this.statements.statementsExport(context.transaction, input, context);
    return result;
  }
}
