import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { PeriodRepository } from '../port/FinanceCommandRepository';

export class PeriodsManageHandler implements OperationHandler<'finance.periods.manage', 'write'> {
  readonly operation = 'finance.periods.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly accounts: PeriodRepository) {}
  async execute(input: OperationInputFor<'finance.periods.manage'>, context: WriteHandlerContext<'finance.periods.manage'>) {
    const result = await this.accounts.periodsManage(context.transaction, input, context);
    return result;
  }
}
