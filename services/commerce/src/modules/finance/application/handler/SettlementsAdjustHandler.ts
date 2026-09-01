import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { SettlementRepository } from '../port/OperationRepositories';

export class SettlementsAdjustHandler implements OperationHandler<'finance.settlements.adjust', 'write'> {
  readonly operation = 'finance.settlements.adjust' as const;
  readonly mode = 'write' as const;
  constructor(private readonly settlements: SettlementRepository) {}
  async execute(input: OperationInputFor<'finance.settlements.adjust'>, context: WriteHandlerContext<'finance.settlements.adjust'>) {
    const result = await this.settlements.settlementsAdjust(context.transaction, input, context);
    return result;
  }
}
