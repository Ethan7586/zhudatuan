import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { SettlementRepository } from '../port/OperationRepositories';

export class WithdrawalsDecideHandler implements OperationHandler<'finance.withdrawals.decide', 'write'> {
  readonly operation = 'finance.withdrawals.decide' as const;
  readonly mode = 'write' as const;
  constructor(private readonly settlements: SettlementRepository) {}
  async execute(input: OperationInputFor<'finance.withdrawals.decide'>, context: WriteHandlerContext<'finance.withdrawals.decide'>) {
    const result = await this.settlements.withdrawalsDecide(context.transaction, input, context);
    return result;
  }
}
