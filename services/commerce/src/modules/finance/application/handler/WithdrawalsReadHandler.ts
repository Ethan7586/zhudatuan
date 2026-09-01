import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { SettlementRepository } from '../port/OperationRepositories';

export class WithdrawalsReadHandler implements OperationHandler<'finance.withdrawals.read', 'read'> {
  readonly operation = 'finance.withdrawals.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly settlements: SettlementRepository) {}
  async execute(input: OperationInputFor<'finance.withdrawals.read'>, context: HandlerContext<'finance.withdrawals.read'>) {
    const result = await this.settlements.withdrawalsRead(context.transaction, input, context);
    return result;
  }
}
