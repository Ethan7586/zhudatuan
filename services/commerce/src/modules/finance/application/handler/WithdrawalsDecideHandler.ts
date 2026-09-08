import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { WithdrawalRepository } from '../port/FinanceCommandRepository';

export class WithdrawalsDecideHandler implements OperationHandler<'finance.withdrawals.decide', 'write'> {
  readonly operation = 'finance.withdrawals.decide' as const;
  readonly mode = 'write' as const;
  constructor(private readonly settlements: WithdrawalRepository) {}
  async execute(input: OperationInputFor<'finance.withdrawals.decide'>, context: WriteHandlerContext<'finance.withdrawals.decide'>) {
    const result = await this.settlements.withdrawalsDecide(context.transaction, input, context);
    return result;
  }
}
