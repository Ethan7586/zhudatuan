import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { WithdrawalRepository } from '../port/FinanceCommandRepository';

export class WithdrawalsRecoverHandler implements OperationHandler<'finance.withdrawals.recover', 'write'> {
  readonly operation = 'finance.withdrawals.recover' as const;
  readonly mode = 'write' as const;
  constructor(private readonly settlements: WithdrawalRepository) {}
  async execute(input: OperationInputFor<'finance.withdrawals.recover'>, context: WriteHandlerContext<'finance.withdrawals.recover'>) {
    const result = await this.settlements.withdrawalsRecover(context.transaction, input, context);
    return result;
  }
}
