import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { SettlementRepository } from '../port/OperationRepositories';

export class SettlementsDecideHandler implements OperationHandler<'finance.settlements.decide', 'write'> {
  readonly operation = 'finance.settlements.decide' as const;
  readonly mode = 'write' as const;
  constructor(private readonly settlements: SettlementRepository) {}
  async execute(input: OperationInputFor<'finance.settlements.decide'>, context: WriteHandlerContext<'finance.settlements.decide'>) {
    const result = await this.settlements.settlementsDecide(context.transaction, input, context);
    return result;
  }
}
