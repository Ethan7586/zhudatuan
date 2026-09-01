import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { LedgerRepository } from '../port/LedgerRepository';
export class LedgersReadHandler implements OperationHandler<'benefit.ledgers.read', 'read'> {
  readonly operation = 'benefit.ledgers.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly ledgers: LedgerRepository) {}
  async execute(input: OperationInputFor<'benefit.ledgers.read'>, context: HandlerContext<'benefit.ledgers.read'>) {
    const result = await this.ledgers.readLedger(context.transaction, input, context);
    return result;
  }
}
