import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { RepairReadRepository } from '../port/FinanceReadRepository';

export class RepairsReadHandler implements OperationHandler<'finance.reconciliationrepairs.read', 'read'> {
  readonly operation = 'finance.reconciliationrepairs.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly repairs: RepairReadRepository) {}
  async execute(input: OperationInputFor<'finance.reconciliationrepairs.read'>, context: HandlerContext<'finance.reconciliationrepairs.read'>) {
    const result = await this.repairs.repairsRead(context.transaction, input, context);
    return result;
  }
}
