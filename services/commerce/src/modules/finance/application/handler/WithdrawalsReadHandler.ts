import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { WithdrawalReadRepository } from '../port/FinanceReadRepository';

export class WithdrawalsReadHandler implements OperationHandler<'finance.withdrawals.read', 'read'> {
  readonly operation = 'finance.withdrawals.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly settlements: WithdrawalReadRepository) {}
  async execute(input: OperationInputFor<'finance.withdrawals.read'>, context: HandlerContext<'finance.withdrawals.read'>) {
    const result = await this.settlements.withdrawalsRead(context.transaction, input, context);
    return result;
  }
}
