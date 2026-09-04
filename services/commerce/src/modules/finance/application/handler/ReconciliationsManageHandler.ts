import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { ReconciliationRepository } from '../port/FinanceCommandRepository';

export class ReconciliationsManageHandler implements OperationHandler<'finance.reconciliations.manage', 'write'> {
  readonly operation = 'finance.reconciliations.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly statements: ReconciliationRepository) {}
  async execute(input: OperationInputFor<'finance.reconciliations.manage'>, context: WriteHandlerContext<'finance.reconciliations.manage'>) {
    const result = await this.statements.reconciliationsManage(context.transaction, input, context);
    return result;
  }
}
