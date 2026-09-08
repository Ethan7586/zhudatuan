import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { SettlementReadRepository } from '../port/FinanceReadRepository';

export class SettlementsReadHandler implements OperationHandler<'finance.settlements.read', 'read'> {
  readonly operation = 'finance.settlements.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly settlements: SettlementReadRepository) {}
  async execute(input: OperationInputFor<'finance.settlements.read'>, context: HandlerContext<'finance.settlements.read'>) {
    const result = await this.settlements.settlementsRead(context.transaction, input, context);
    return result;
  }
}
