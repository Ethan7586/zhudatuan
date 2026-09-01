import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { LotRepository } from '../port/LotRepository';
export class LotsReadHandler implements OperationHandler<'benefit.lots.read', 'read'> {
  readonly operation = 'benefit.lots.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly lots: LotRepository) {}
  async execute(input: OperationInputFor<'benefit.lots.read'>, context: HandlerContext<'benefit.lots.read'>) {
    const result = await this.lots.readLots(context.transaction, input, context);
    return result;
  }
}
