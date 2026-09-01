import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { SettlementRepository } from '../port/OperationRepositories';

export class WithdrawalsCreateHandler implements OperationHandler<'finance.withdrawals.create', 'write'> {
  readonly operation = 'finance.withdrawals.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly settlements: SettlementRepository) {}
  async execute(input: OperationInputFor<'finance.withdrawals.create'>, context: WriteHandlerContext<'finance.withdrawals.create'>) {
    const result = await this.settlements.withdrawalsCreate(context.transaction, input, context);
    return result;
  }
}
