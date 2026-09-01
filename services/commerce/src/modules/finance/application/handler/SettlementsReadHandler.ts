import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { SettlementRepository } from '../port/OperationRepositories';

export class SettlementsReadHandler implements OperationHandler<'finance.settlements.read', 'read'> {
  readonly operation = 'finance.settlements.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly settlements: SettlementRepository) {}
  async execute(input: OperationInputFor<'finance.settlements.read'>, context: HandlerContext<'finance.settlements.read'>) {
    const result = await this.settlements.settlementsRead(context.transaction, input, context);
    return result;
  }
}
